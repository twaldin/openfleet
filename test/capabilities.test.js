const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

const { loadDeploymentConfig } = require("../core/deployment")
const {
  loadCapability,
  resolveCapabilityProjection,
  validateCapabilitySchema,
} = require("../core/capabilities")
const { projectInstructions } = require("../core/instructions")

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

function loadExampleDeployment() {
  return loadDeploymentConfig(path.join(__dirname, "fixtures", "deployment.json"))
}

function writeAgents(stateRoot, agents) {
  fs.mkdirSync(stateRoot, { recursive: true })
  fs.writeFileSync(path.join(stateRoot, "agents.json"), `${JSON.stringify({ agents }, null, 2)}\n`, "utf8")
}

test("loadCapability loads a capability from the shared library index", () => {
  const capability = loadCapability("code-review-skill")

  assert.equal(capability.name, "code-review-skill")
  assert.equal(capability.type, "skills")
  assert.equal(capability.description.length > 0, true)
})

test("validateCapabilitySchema rejects malformed capability docs", () => {
  assert.throws(
    () => validateCapabilitySchema({ name: "broken", type: "skills", projections: {} }, "broken.json"),
    /description/
  )
})

test("resolveCapabilityProjection returns the harness-specific projection", () => {
  const capability = loadCapability("filesystem-mcp")

  assert.deepEqual(resolveCapabilityProjection(capability, "opencode"), capability.projections.opencode)
  assert.equal(resolveCapabilityProjection(loadCapability("workspace-write"), "codex"), null)
})

test("projectInstructions writes capability projections for the selected harness", () => {
  const deployment = loadExampleDeployment()
  const stateRoot = tempDir("openfleet-capabilities-state-")
  const workdir = tempDir("openfleet-capabilities-workdir-")

  writeAgents(stateRoot, {
    reviewer: {
      name: "reviewer",
      role: "coder",
      capabilities: ["code-review-skill", "filesystem-mcp", "guarded-commands-hook"],
    },
  })

  projectInstructions("reviewer", "coder", "opencode", workdir, deployment, { stateRoot })

  assert.match(fs.readFileSync(path.join(workdir, ".opencode", "skills", "code-review.md"), "utf8"), /Code Review Skill/)
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(workdir, ".opencode", "mcp", "filesystem.json"), "utf8")),
    {
      transport: "stdio",
      command: ["npx", "-y", "@modelcontextprotocol/server-filesystem", "."],
    }
  )
  assert.match(fs.readFileSync(path.join(workdir, ".opencode", "hooks", "pre-command.sh"), "utf8"), /blocked destructive command/)
})

test("projectInstructions warns and skips capabilities without a harness projection", () => {
  const deployment = loadExampleDeployment()
  const stateRoot = tempDir("openfleet-capabilities-state-")
  const workdir = tempDir("openfleet-capabilities-workdir-")

  writeAgents(stateRoot, {
    reviewer: {
      name: "reviewer",
      role: "coder",
      capabilities: ["workspace-write"],
    },
  })

  const warnings = []
  const originalWarn = console.warn
  console.warn = (message) => warnings.push(message)

  try {
    projectInstructions("reviewer", "coder", "codex", workdir, deployment, { stateRoot })
  } finally {
    console.warn = originalWarn
  }

  assert.equal(fs.existsSync(path.join(workdir, ".codex", "permissions", "workspace-write.json")), false)
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /workspace-write/)
  assert.match(warnings[0], /codex/)
})

test("loadCapability throws for a missing capability name", () => {
  assert.throws(() => loadCapability("missing-capability"), /Capability not found/)
})
