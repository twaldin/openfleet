const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

const { loadDeploymentConfig } = require("../core/deployment")
const { buildAgentInstructions, projectInstructions } = require("../core/instructions")

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openfleet-instructions-"))
}

function loadExampleDeployment() {
  return loadDeploymentConfig(path.join(__dirname, "..", "examples", "cairn", "deployment.json"))
}

test("buildAgentInstructions includes identity, channels, and OpenFleet protocols", () => {
  const deployment = loadExampleDeployment()
  const text = buildAgentInstructions("instruction-builder", "coder", deployment)

  assert.match(text, /- Name: instruction-builder/)
  assert.match(text, /- Role: coder/)
  assert.match(text, /- Parent: cairn/)
  assert.match(text, /- Agent channel: channel:\/\/code-status/)
  assert.match(text, /- Status channel: channel:\/\/fleet-status/)
  assert.match(text, /- Blocker channel:/)
  assert.match(text, /node .*\/bin\/send --to-parent --sender instruction-builder --message/)
  assert.match(text, /node .*\/bin\/remote discord post --channel "channel:\/\/code-status"/)
  assert.match(text, /node .*\/bin\/report-completion <job-id> --summary/)
  assert.match(text, /node .*\/bin\/task-state blocker create --job <job-id> --workflow <workflow-id> --agent instruction-builder/)
})

test("projectInstructions writes a dedicated OpenCode agent file", () => {
  const deployment = loadExampleDeployment()
  const dir = tempDir()
  const targetPath = projectInstructions("instruction-builder", "coder", "opencode", dir, deployment)

  assert.equal(targetPath, path.join(dir, ".opencode", "agents", "instruction-builder.md"))
  const content = fs.readFileSync(targetPath, "utf8")
  assert.match(content, /OPENFLEET AGENT/)
  assert.doesNotMatch(content, /OPENFLEET:START/)
})

test("projectInstructions appends and replaces the OpenFleet section in CLAUDE.md", () => {
  const deployment = loadExampleDeployment()
  const dir = tempDir()
  const targetPath = path.join(dir, "CLAUDE.md")

  fs.writeFileSync(targetPath, "# Existing\n\nKeep this.\n", "utf8")
  projectInstructions("instruction-builder", "coder", "claude-code", dir, deployment)

  const firstPass = fs.readFileSync(targetPath, "utf8")
  assert.match(firstPass, /# Existing/)
  assert.match(firstPass, /<!-- OPENFLEET:START -->/)
  assert.match(firstPass, /- Role: coder/)

  projectInstructions("instruction-builder", "evaluator", "claude-code", dir, deployment)
  const secondPass = fs.readFileSync(targetPath, "utf8")
  assert.match(secondPass, /# Existing/)
  assert.equal((secondPass.match(/<!-- OPENFLEET:START -->/g) || []).length, 1)
  assert.match(secondPass, /- Role: evaluator/)
  assert.doesNotMatch(secondPass, /- Role: coder/)
})

test("projectInstructions appends the OpenFleet section to AGENTS.md", () => {
  const deployment = loadExampleDeployment()
  const dir = tempDir()
  const targetPath = path.join(dir, "AGENTS.md")

  fs.writeFileSync(targetPath, "# Base agents\n", "utf8")
  projectInstructions("instruction-builder", "coder", "codex", dir, deployment)

  const content = fs.readFileSync(targetPath, "utf8")
  assert.match(content, /# Base agents/)
  assert.match(content, /# OpenFleet/)
  assert.match(content, /- Role: coder/)
})
