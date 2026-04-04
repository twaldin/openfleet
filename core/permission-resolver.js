const os = require("os")
const path = require("path")
const { execFileSync } = require("child_process")

const { DEFAULT_APPROVE_SEQUENCE, DEFAULT_DENY_SEQUENCE, PERMISSION_PATTERNS } = require("./permission-patterns")

const ANSI_RE = /\x1b\[[0-9;?]*[ -/]*[@-~]/g
const PATH_TOKEN_RE = /(?:~\/|\/)[^\s"'`()\[\]{}<>]+/g
const RISKY_OP_RE = /\b(rm|delete|del|unlink|rmdir|trash)\b/i

function stripAnsi(text) {
  return String(text || "").replace(ANSI_RE, "")
}

function normalizePaneText(text) {
  return stripAnsi(text).replace(/\r/g, "").trim()
}

function matchPermissionPattern(paneText, patterns = PERMISSION_PATTERNS) {
  const clean = normalizePaneText(paneText)
  for (const pattern of patterns) {
    if (pattern.matchers.every((matcher) => matcher.test(clean))) {
      return pattern
    }
  }
  return null
}

function extractRequestLine(clean) {
  const lines = clean.split("\n").map((line) => line.trim()).filter(Boolean)
  for (const line of lines) {
    if (RISKY_OP_RE.test(line)) return line
    if (extractPrimaryPath(line)) return line
  }
  return clean
}

function extractPrimaryPath(text) {
  if (!text) return null

  const quoted = text.match(/["'`]((?:~\/|\/)[^"'`]+)["'`]/)
  if (quoted?.[1]) return trimPath(quoted[1])

  const paren = text.match(/\(((?:~\/|\/)[^)]+)\)/)
  if (paren?.[1]) return trimPath(paren[1])

  const matches = text.match(PATH_TOKEN_RE)
  if (!matches || matches.length === 0) return null
  return trimPath(matches.sort((left, right) => right.length - left.length)[0])
}

function trimPath(value) {
  return String(value || "").trim().replace(/[?.,:;]+$/, "")
}

function expandHome(value) {
  if (!value) return value
  if (value === "~") return os.homedir()
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2))
  return value
}

function normalizePathCandidate(value) {
  const expanded = expandHome(trimPath(value))
  if (!expanded || !path.isAbsolute(expanded)) return null
  return path.resolve(expanded)
}

function extractNormalizedPaths(text) {
  return [...new Set((String(text || "").match(PATH_TOKEN_RE) || [])
    .map(normalizePathCandidate)
    .filter(Boolean))]
}

function isWithinRoot(candidate, root) {
  if (!candidate || !root) return false
  return candidate === root || candidate.startsWith(`${root}/`)
}

function evaluateSafety(requestedPath, agentWorkdir) {
  const request = String(requestedPath || "").trim()
  if (!request) return "risky"
  if (RISKY_OP_RE.test(request)) return "risky"

  const agentRoot = normalizePathCandidate(agentWorkdir || "")
  const candidates = extractNormalizedPaths(request)
  if (candidates.length === 0) return "risky"

  for (const candidate of candidates) {
    if (/\/(?:\.ssh|\.openfleet)(\/|$)/.test(candidate)) return "risky"
    if (/^\/tmp\/openfleet-[^/]+/.test(candidate)) return "safe"
    if (/\/openfleet-wt-[^/]+/.test(candidate)) return "safe"
    if (agentRoot && isWithinRoot(candidate, agentRoot)) return "safe"
  }

  return "risky"
}

function parsePermissionPrompt(paneText, options = {}) {
  const clean = normalizePaneText(paneText)
  const pattern = matchPermissionPattern(clean, options.patterns || PERMISSION_PATTERNS)
  if (!pattern) return null

  const request = extractRequestLine(clean)
  const extractedPath = extractPrimaryPath(request) || extractPrimaryPath(clean) || request

  return {
    detected: true,
    agent: options.agent || null,
    patternId: pattern.id,
    label: pattern.label,
    path: extractedPath,
    request,
    approveSequence: pattern.approveSequence || DEFAULT_APPROVE_SEQUENCE,
    denySequence: pattern.denySequence || DEFAULT_DENY_SEQUENCE,
  }
}

function sendKeySequence(tmuxSession, tmuxWindow, keySequence, options = {}) {
  const exec = options.exec || execFileSync
  const target = `${tmuxSession}:${tmuxWindow}`
  for (const key of keySequence) {
    exec("tmux", ["send-keys", "-t", target, key], { stdio: "ignore" })
  }
}

function approveViaKeys(tmuxSession, tmuxWindow, keySequence = DEFAULT_APPROVE_SEQUENCE, options = {}) {
  sendKeySequence(tmuxSession, tmuxWindow, keySequence, options)
}

function denyViaKeys(tmuxSession, tmuxWindow, keySequence = DEFAULT_DENY_SEQUENCE, options = {}) {
  sendKeySequence(tmuxSession, tmuxWindow, keySequence, options)
}

function buildEscalationMessage(agent, requestedPath) {
  return [
    "Permission prompt requires review.",
    `Agent: ${agent}`,
    `Requested path: ${requestedPath || "(unknown)"}`,
    "React ✅ to approve or ❌ to deny.",
  ].join("\n")
}

module.exports = {
  approveViaKeys,
  buildEscalationMessage,
  denyViaKeys,
  evaluateSafety,
  matchPermissionPattern,
  parsePermissionPrompt,
  sendKeySequence,
}
