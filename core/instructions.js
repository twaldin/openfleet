const fs = require("fs")
const path = require("path")
const os = require("os")
const { loadCapability, writeCapabilityProjection } = require("./capabilities")
const { getPlaybook } = require("./playbooks")
const { resolveChannelBinding } = require("./routing")
const { getAgent } = require("./runtime/agents")

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
  const isPersistent = role === "persistent" || role === "orchestrator"
  const rootDir = path.resolve(__dirname, "..")

  const sections = []

  // --- Identity: inline SOUL.md (small, ~20 lines, defines who the agent is) ---
  if (isPersistent) {
    const soul = readWorkspaceFile(workspaceDir, "SOUL.md")
    if (soul) sections.push(soul)
  }

  // --- Workspace AGENTS.md (if exists, inline — operational instructions) ---
  const agentsFile = readWorkspaceFile(workspaceDir, "AGENTS.md")
  if (agentsFile) {
    sections.push(agentsFile)
  }

  // --- OpenFleet commands (always, ~15 lines) ---
  sections.push(buildOpenFleetCommands(agent, role, deployment, rootDir))

  // --- Memory: REFERENCE only, don't inline (harness-agnostic) ---
  if (isPersistent) {
    const today = new Date().toISOString().slice(0, 10)
    const memoryRef = [
      `# Startup — Read These Files`,
      `On session start, read these files for current state:`,
      `- ${path.join(workspaceDir, "MEMORY.md")} — durable memory`,
      `- ${path.join(workspaceDir, "memory", today + ".md")} — today's log`,
    ]
    const heartbeat = readWorkspaceFile(workspaceDir, "HEARTBEAT.md")
    if (heartbeat) {
      memoryRef.push(`- ${path.join(workspaceDir, "HEARTBEAT.md")} — periodic checklist`)
    }
    sections.push(memoryRef.join("\n"))
  }

  // --- Role playbook fallback (if no workspace files exist) ---
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
    `Post to your channel: openfleet post "<msg>"`,
    `Message parent: node ${sendBin} --to-parent --sender ${agent} --message "<update>"`,
    ``,
    `## Completion Protocol`,
    `When job is done: node ${reportCompletionBin} <job-id> --summary "<summary>"`,
    ``,
    `## Blocked Task Protocol`,
    `When blocked on a task: node ${taskStateBin} task update <task-id> --status blocked --blocked-on "<need>"`,
    ``,
    `## Compaction Protocol`,
    `When context is heavy or told to compact:`,
    `1. Save state to ~/.openfleet/agents/${agent}/MEMORY.md`,
    `2. Append today's key events to ~/.openfleet/agents/${agent}/memory/YYYY-MM-DD.md`,
    `3. Post status to your channel`,
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
function projectInstructions(agent, role, harness, workdir, deployment, options = {}) {
  if (!harness) throw new Error("harness is required")
  if (!workdir) throw new Error("workdir is required")

  const instructions = buildAgentInstructions(agent, role, deployment, options)
  const resolvedWorkdir = path.resolve(workdir)
  const targetPath = projectBaseInstructions(agent, harness, resolvedWorkdir, instructions)

  projectAgentCapabilities(agent, harness, resolvedWorkdir, options)
  return targetPath
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

function projectBaseInstructions(agent, harness, workdir, instructions) {
  if (harness === "opencode") {
    const targetPath = path.join(workdir, ".opencode", "agents", `${agent}.md`)
    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    fs.writeFileSync(targetPath, `${instructions}\n`, "utf8")
    return targetPath
  }

  if (harness === "claude-code") {
    const targetPath = path.join(workdir, "CLAUDE.md")
    writeProjectedSection(targetPath, instructions)
    return targetPath
  }

  if (harness === "codex") {
    const targetPath = path.join(workdir, "AGENTS.md")
    writeProjectedSection(targetPath, instructions)
    return targetPath
  }

  const targetPath = path.join(workdir, ".openfleet", "instructions", harness, `${agent}.md`)
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  fs.writeFileSync(targetPath, `${instructions}\n`, "utf8")
  return targetPath
}

function projectAgentCapabilities(agent, harness, workdir, options = {}) {
  const capabilityNames = getAgentCapabilityNames(agent, options)
  if (capabilityNames.length === 0) return []

  const writtenPaths = []

  for (const capabilityName of capabilityNames) {
    let capability
    try {
      capability = loadCapability(capabilityName, options)
    } catch (error) {
      if (error && /Capability not found:/.test(error.message)) {
        console.warn(`Skipping capability ${capabilityName} for agent ${agent}: capability is not defined in the library`)
        continue
      }

      throw error
    }

    const targetPath = writeCapabilityProjection(capability, harness, workdir)
    if (!targetPath) {
      console.warn(`Skipping capability ${capability.name} for harness ${harness}: projection is not defined`)
      continue
    }

    writtenPaths.push(targetPath)
  }

  return writtenPaths
}

function getAgentCapabilityNames(agent, options = {}) {
  const stateRoot = options.stateRoot || process.env.OPENFLEET_CANONICAL_STATE_DIR || path.join(os.homedir(), ".openfleet")
  const agentRecord = getAgent(stateRoot, agent)
  return Array.isArray(agentRecord?.capabilities) ? agentRecord.capabilities : []
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
  getAgentCapabilityNames,
  projectInstructions,
  projectAgentCapabilities,
  readWorkspaceFile,
}
