const fs = require("fs")
const path = require("path")
const os = require("os")
const { getPlaybook } = require("./playbooks")
const { resolveChannelBinding } = require("./routing")

const OPENFLEET_SECTION_START = "<!-- OPENFLEET:START -->"
const OPENFLEET_SECTION_END = "<!-- OPENFLEET:END -->"

/**
 * Build the full instruction payload for an agent by reading its workspace files.
 *
 * Persistent/orchestrator agents (full workspace):
 *   SOUL.md + AGENTS.md + MEMORY.md summary + openfleet commands
 *
 * Ephemeral agents (stripped, like OpenClaw sub-agents):
 *   AGENTS.md + openfleet commands only
 */
function buildAgentInstructions(agent, role, deployment, options = {}) {
  if (!agent) throw new Error("agent is required")

  const stateRoot = options.stateRoot || process.env.OPENFLEET_CANONICAL_STATE_DIR || path.join(os.homedir(), ".openfleet")
  const workspaceDir = path.join(stateRoot, "agents", agent)
  const isPersistent = role === "persistent" || role === "orchestrator" || role === "monitor"
  const rootDir = path.resolve(__dirname, "..")

  const sections = []

  // --- SOUL.md (persistent/orchestrator only) ---
  if (isPersistent) {
    const soul = readWorkspaceFile(workspaceDir, "SOUL.md")
    if (soul) sections.push(soul)
  }

  // --- AGENTS.md from workspace (if exists) ---
  const agentsFile = readWorkspaceFile(workspaceDir, "AGENTS.md")
  if (agentsFile) {
    sections.push(agentsFile)
  }

  // --- MEMORY.md summary (persistent only, first 50 lines) ---
  if (isPersistent) {
    const memory = readWorkspaceFile(workspaceDir, "MEMORY.md")
    if (memory) {
      const summary = memory.split("\n").slice(0, 50).join("\n")
      sections.push("# Current Memory\n" + summary)
    }
  }

  // --- Today's daily log (persistent only) ---
  if (isPersistent) {
    const today = new Date().toISOString().slice(0, 10)
    const dailyLog = readWorkspaceFile(path.join(workspaceDir, "memory"), `${today}.md`)
    if (dailyLog) {
      const recent = dailyLog.split("\n").slice(-30).join("\n")
      sections.push("# Today's Log\n" + recent)
    }
  }

  // --- OpenFleet commands (always injected) ---
  sections.push(buildOpenFleetCommands(agent, role, deployment, rootDir))

  // --- Role playbook (if no SOUL.md/AGENTS.md in workspace) ---
  if (!agentsFile) {
    const playbook = getPlaybook(role) || getPlaybook(agent)
    if (playbook) sections.push(playbook)
  }

  return sections.join("\n\n")
}

/**
 * Build the OpenFleet-specific command reference block.
 */
function buildOpenFleetCommands(agent, role, deployment, rootDir) {
  const sendBin = path.join(rootDir, "bin", "send")
  const remoteBin = path.join(rootDir, "bin", "remote")
  const reportCompletionBin = path.join(rootDir, "bin", "report-completion")
  const taskStateBin = path.join(rootDir, "bin", "task-state")
  const routing = deployment?.routing || {}
  const agentChannel = resolveChannelBinding(routing, { agent: role }) || resolveChannelBinding(routing, { agent }) || null
  const stateRoot = process.env.OPENFLEET_CANONICAL_STATE_DIR || path.join(os.homedir(), ".openfleet")

  const lines = [
    `# OpenFleet Commands`,
    ``,
    `Message parent: node ${sendBin} --to-parent --sender ${agent} --message "<update>"`,
    `Post to Discord: node ${remoteBin} discord post --channel "${agentChannel || ""}" --message "<msg>"`,
    ``,
    `## Completion Protocol`,
    `When job is done: node ${reportCompletionBin} <job-id> --summary "<summary>" --continue --execute`,
    ``,
    `## Blocker Protocol`,
    `When blocked: node ${taskStateBin} blocker create --agent ${agent} --summary "<what>" --question "<need>"`,
    ``,
    `## Compaction Protocol`,
    `When context is heavy or told to compact:`,
    `1. Save state to ~/.openfleet/agents/${agent}/MEMORY.md`,
    `2. Append today's key events to ~/.openfleet/agents/${agent}/memory/YYYY-MM-DD.md`,
    `3. Post status to Discord channel`,
    `4. Message parent: "Compacted. State saved."`,
    `On restart: read SOUL.md, MEMORY.md, and today's log first.`,
  ]

  return lines.join("\n")
}

/**
 * Project workspace files into the harness-specific instruction format.
 *
 * For persistent agents: reads SOUL.md + AGENTS.md + MEMORY.md from workspace
 * For ephemeral agents: just AGENTS.md + openfleet commands
 */
function projectInstructions(agent, role, harness, workdir, deployment, options) {
  if (!harness) throw new Error("harness is required")
  if (!workdir) throw new Error("workdir is required")

  const instructions = buildAgentInstructions(agent, role, deployment, options)
  const resolvedWorkdir = path.resolve(workdir)

  if (harness === "opencode") {
    const targetPath = path.join(resolvedWorkdir, ".opencode", "agents", `${agent}.md`)
    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    fs.writeFileSync(targetPath, `${instructions}\n`, "utf8")
    return targetPath
  }

  if (harness === "claude-code") {
    const targetPath = path.join(resolvedWorkdir, "CLAUDE.md")
    writeProjectedSection(targetPath, instructions)
    return targetPath
  }

  if (harness === "codex") {
    const targetPath = path.join(resolvedWorkdir, "AGENTS.md")
    writeProjectedSection(targetPath, instructions)
    return targetPath
  }

  throw new Error(`Unsupported harness: ${harness}`)
}

// --- Helpers ---

function readWorkspaceFile(dir, filename) {
  try {
    const content = fs.readFileSync(path.join(dir, filename), "utf8").trim()
    return content || null
  } catch {
    return null
  }
}

function writeProjectedSection(targetPath, instructions) {
  const section = [
    OPENFLEET_SECTION_START,
    "# OpenFleet",
    "",
    instructions,
    OPENFLEET_SECTION_END,
    "",
  ].join("\n")

  let next = section
  if (fs.existsSync(targetPath)) {
    const current = fs.readFileSync(targetPath, "utf8")
    next = hasProjectedSection(current)
      ? replaceProjectedSection(current, section)
      : appendProjectedSection(current, section)
  } else {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  }

  fs.writeFileSync(targetPath, next, "utf8")
}

function hasProjectedSection(text) {
  return text.includes(OPENFLEET_SECTION_START) && text.includes(OPENFLEET_SECTION_END)
}

function replaceProjectedSection(text, section) {
  const pattern = new RegExp(`${escapeRegex(OPENFLEET_SECTION_START)}[\\s\\S]*?${escapeRegex(OPENFLEET_SECTION_END)}\\n?`, "m")
  return text.replace(pattern, section)
}

function appendProjectedSection(text, section) {
  const trimmed = text.replace(/\s*$/, "")
  if (!trimmed) return section
  return `${trimmed}\n\n${section}`
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

module.exports = {
  buildAgentInstructions,
  buildOpenFleetCommands,
  projectInstructions,
  readWorkspaceFile,
}
