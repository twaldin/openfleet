const test = require("node:test")
const assert = require("node:assert/strict")

const {
  parsePermissionPrompt,
  evaluateSafety,
  approveViaKeys,
  buildEscalationMessage,
} = require("../core/permission-resolver")
const { PERMISSION_PATTERNS } = require("../core/permission-patterns")

test("permission patterns are configurable for multiple harnesses", () => {
  const ids = PERMISSION_PATTERNS.map((pattern) => pattern.id)

  assert.ok(ids.includes("opencode"))
  assert.ok(ids.includes("claude-code"))
  assert.ok(ids.includes("codex"))
  assert.ok(ids.includes("generic"))
})

test("parsePermissionPrompt detects OpenCode permission prompts and extracts the requested path", () => {
  const paneText = [
    "Permission required",
    "OpenCode wants to access:",
    "  /tmp/openfleet-task-123/**",
    "",
    "Allow once   Allow always   Reject",
  ].join("\n")

  const result = parsePermissionPrompt(paneText, { agent: "perm-coder" })

  assert.equal(result.detected, true)
  assert.equal(result.agent, "perm-coder")
  assert.equal(result.patternId, "opencode")
  assert.equal(result.path, "/tmp/openfleet-task-123/**")
  assert.deepEqual(result.approveSequence, ["Right", "Enter", "Enter"])
})

test("parsePermissionPrompt detects Claude Code prompts from the shared pattern config", () => {
  const paneText = [
    "Do you want to allow this tool to read a file?",
    'Read("~/.ssh/config")',
    "y/n",
  ].join("\n")

  const result = parsePermissionPrompt(paneText, { agent: "claude-coder" })

  assert.equal(result.detected, true)
  assert.equal(result.patternId, "claude-code")
  assert.equal(result.path, "~/.ssh/config")
})

test("parsePermissionPrompt detects Codex prompts from the shared pattern config", () => {
  const paneText = [
    "Do you trust the contents of /private/tmp/openfleet-wt-coder-123?",
    "trust options: trust once / trust always / reject",
  ].join("\n")

  const result = parsePermissionPrompt(paneText, { agent: "codex-coder" })

  assert.equal(result.detected, true)
  assert.equal(result.patternId, "codex")
  assert.equal(result.path, "/private/tmp/openfleet-wt-coder-123")
})

test("parsePermissionPrompt falls back to a generic permission matcher", () => {
  const paneText = [
    "permission request for /etc/passwd",
    "allow / deny / reject",
  ].join("\n")

  const result = parsePermissionPrompt(paneText, { agent: "fallback-coder" })

  assert.equal(result.detected, true)
  assert.equal(result.patternId, "generic")
  assert.equal(result.path, "/etc/passwd")
})

test("evaluateSafety distinguishes safe paths from risky paths", () => {
  const agentWorkdir = "/Users/tim/src/project"

  assert.equal(evaluateSafety("/tmp/openfleet-task-123/cache", agentWorkdir), "safe")
  assert.equal(evaluateSafety("/private/var/folders/abc/openfleet-wt-coder-123/src", agentWorkdir), "safe")
  assert.equal(evaluateSafety("/Users/tim/src/project/src/index.js", agentWorkdir), "safe")

  assert.equal(evaluateSafety("~/.ssh/config", agentWorkdir), "risky")
  assert.equal(evaluateSafety("rm -rf /tmp/openfleet-task-123", agentWorkdir), "risky")
  assert.equal(evaluateSafety("/etc/passwd", agentWorkdir), "risky")
})

test("approveViaKeys sends the allow-always tmux key sequence", () => {
  const calls = []

  approveViaKeys("openfleet", "perm-coder", ["Right", "Enter", "Enter"], {
    exec(file, args, options) {
      calls.push({ file, args, options })
    },
  })

  assert.deepEqual(calls.map((call) => [call.file, ...call.args]), [
    ["tmux", "send-keys", "-t", "openfleet:perm-coder", "Right"],
    ["tmux", "send-keys", "-t", "openfleet:perm-coder", "Enter"],
    ["tmux", "send-keys", "-t", "openfleet:perm-coder", "Enter"],
  ])
})

test("buildEscalationMessage formats a Discord-ready risky prompt alert", () => {
  const message = buildEscalationMessage("perm-coder", "~/.ssh/config")

  assert.match(message, /Permission prompt requires review/)
  assert.match(message, /Agent: perm-coder/)
  assert.match(message, /Requested path: ~\/\.ssh\/config/)
  assert.match(message, /React ✅ to approve or ❌ to deny/)
})
