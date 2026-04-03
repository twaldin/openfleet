const fs = require("fs")
const path = require("path")
const { getPlaybook } = require("./playbooks")
const { resolveChannelBinding } = require("./routing")

const OPENFLEET_SECTION_START = "<!-- OPENFLEET:START -->"
const OPENFLEET_SECTION_END = "<!-- OPENFLEET:END -->"

function buildAgentInstructions(agent, role, deployment) {
  if (!agent) throw new Error("agent is required")
  if (!role) throw new Error("role is required")
  if (!deployment) throw new Error("deployment is required")

  const rootDir = path.resolve(__dirname, "..")
  const sendBin = path.join(rootDir, "bin", "send")
  const remoteBin = path.join(rootDir, "bin", "remote")
  const reportCompletionBin = path.join(rootDir, "bin", "report-completion")
  const taskStateBin = path.join(rootDir, "bin", "task-state")

  const routing = deployment.routing || {}
  const serverArchitecture = routing.server_architecture || {}
  const agentChannel = resolveChannelBinding(routing, { agent: role }) || resolveChannelBinding(routing, { agent }) || null
  const parentAgent = deployment.parent?.agent || "parent"
  const playbook = getPlaybook(role) || getPlaybook(agent)

  const lines = [
    `OPENFLEET AGENT`,
    `- Name: ${agent}`,
    `- Role: ${role}`,
    `- Parent: ${parentAgent}`,
  ]

  if (playbook) {
    lines.push(`- Role playbook:`)
    lines.push(...playbook.split("\n").map((line) => `  ${line}`))
  }

  lines.push(
    ``,
    `CHANNELS`,
    `- Agent channel: ${agentChannel || "none"}`,
    `- Default human channel: ${routing.default_human_channel || "none"}`,
    `- Status channel: ${serverArchitecture.status_channel || "none"}`,
    `- Blocker channel: ${serverArchitecture.blocker_channel || "none"}`,
    `- Approval channel: ${serverArchitecture.approval_channel || "none"}`,
    ``,
    `COMMANDS`,
    `- Message parent: node ${sendBin} --to-parent --sender ${agent} --message "<concise update>"`,
    `- Post to Discord: node ${remoteBin} discord post --channel "${agentChannel || routing.default_human_channel || ""}" --message "<message>"`,
    `- Discord channels accept deployment bindings like channel://code-status or a raw Discord channel id.`,
    ``,
    `COMPLETION PROTOCOL`,
    `- When the assigned job is actually complete, run: node ${reportCompletionBin} <job-id> --summary "<one concise summary>" --continue --execute`,
    `- Do not report completion early.`,
    ``,
    `BLOCKER PROTOCOL`,
    `- If missing context blocks safe progress, create a blocker instead of guessing.`,
    `- Use: node ${taskStateBin} blocker create --job <job-id> --workflow <workflow-id> --agent ${agent} --summary "<short blocker summary>" --question "<what you need from the human>" --type human --channel "${agentChannel || routing.default_human_channel || ""}"`,
  )

  return lines.join("\n")
}

function projectInstructions(agent, role, harness, workdir, deployment) {
  if (!harness) throw new Error("harness is required")
  if (!workdir) throw new Error("workdir is required")

  const instructions = buildAgentInstructions(agent, role, deployment)
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
  projectInstructions,
}
