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
  return loadDeploymentConfig(path.join(__dirname, "fixtures", "deployment.json"))
}

test("buildAgentInstructions includes OpenFleet commands and playbook for ephemeral agent", () => {
  const deployment = loadExampleDeployment()
  const text = buildAgentInstructions("test-coder", "coder", deployment)

  // Should have openfleet commands
  assert.match(text, /# OpenFleet Commands/)
  assert.match(text, /node .*\/bin\/send --to-parent --sender test-coder/)
  assert.match(text, /openfleet post/)
  assert.match(text, /## Completion Protocol/)
  assert.match(text, /## Blocker Protocol/)
  assert.match(text, /## Compaction Protocol/)
  // Should have playbook (no workspace files for this agent)
  assert.match(text, /CODER PLAYBOOK/)
})

test("buildAgentInstructions reads workspace SOUL.md for persistent agent", () => {
  const deployment = loadExampleDeployment()
  // Use cairn which has a workspace with SOUL.md
  const text = buildAgentInstructions("cairn", "orchestrator", deployment)

  // Should include SOUL.md content if workspace exists
  assert.match(text, /# OpenFleet Commands/)
  assert.match(text, /## Compaction Protocol/)
})

test("projectInstructions writes a dedicated OpenCode agent file", () => {
  const deployment = loadExampleDeployment()
  const dir = tempDir()
  const targetPath = projectInstructions("test-coder", "coder", "opencode", dir, deployment)

  assert.equal(targetPath, path.join(dir, ".opencode", "agents", "test-coder.md"))
  const content = fs.readFileSync(targetPath, "utf8")
  assert.match(content, /# OpenFleet Commands/)
  assert.doesNotMatch(content, /OPENFLEET:START/)
})

test("projectInstructions appends and replaces the OpenFleet section in CLAUDE.md", () => {
  const deployment = loadExampleDeployment()
  const dir = tempDir()
  const targetPath = path.join(dir, "CLAUDE.md")

  fs.writeFileSync(targetPath, "# Existing\n\nKeep this.\n", "utf8")
  projectInstructions("test-coder", "coder", "claude-code", dir, deployment)

  const firstPass = fs.readFileSync(targetPath, "utf8")
  assert.match(firstPass, /# Existing/)
  assert.match(firstPass, /<!-- OPENFLEET:START -->/)
  assert.match(firstPass, /# OpenFleet Commands/)

  // Second pass should replace, not duplicate
  projectInstructions("test-coder", "coder", "claude-code", dir, deployment)
  const secondPass = fs.readFileSync(targetPath, "utf8")
  assert.equal((secondPass.match(/<!-- OPENFLEET:START -->/g) || []).length, 1)
})

test("projectInstructions appends the OpenFleet section to AGENTS.md", () => {
  const deployment = loadExampleDeployment()
  const dir = tempDir()
  const targetPath = path.join(dir, "AGENTS.md")

  fs.writeFileSync(targetPath, "# Base agents\n", "utf8")
  projectInstructions("test-coder", "coder", "codex", dir, deployment)

  const content = fs.readFileSync(targetPath, "utf8")
  assert.match(content, /# Base agents/)
  assert.match(content, /# OpenFleet/)
  assert.match(content, /CODER PLAYBOOK/)
})
