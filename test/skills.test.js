const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

const { loadDeploymentConfig } = require("../core/deployment")
const {
  buildSkillIndex,
  listSkills,
  loadSkill,
  projectAllSkills,
  projectSkill,
} = require("../core/skills")
const { projectInstructions } = require("../core/instructions")

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

function loadExampleDeployment() {
  return loadDeploymentConfig(path.join(__dirname, "fixtures", "deployment.json"))
}

function writeSkill(skillsRoot, name, description = `${name} description`, body = `# ${name}\n\n${name} body\n`) {
  const skillDir = path.join(skillsRoot, name)
  fs.mkdirSync(skillDir, { recursive: true })
  fs.writeFileSync(
    path.join(skillDir, "SKILL.md"),
    `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}`,
    "utf8"
  )
  return skillDir
}

function writeAgents(stateRoot, agents) {
  fs.mkdirSync(stateRoot, { recursive: true })
  fs.writeFileSync(path.join(stateRoot, "agents.json"), `${JSON.stringify({ agents }, null, 2)}\n`, "utf8")
}

test("loadSkill parses SKILL.md frontmatter", () => {
  const skillsRoot = tempDir("openfleet-skills-root-")
  const skillDir = writeSkill(skillsRoot, "health-check", "Run a health check", "# Health Check\n\nUse this skill to verify service health.\n")

  const skill = loadSkill(skillDir)

  assert.equal(skill.name, "health-check")
  assert.equal(skill.description, "Run a health check")
  assert.equal(skill.content, "# Health Check\n\nUse this skill to verify service health.\n")
  assert.equal(skill.path, path.join(skillDir, "SKILL.md"))
})

test("listSkills scans the skills root and loads each skill", () => {
  const skillsRoot = tempDir("openfleet-skills-root-")
  writeSkill(skillsRoot, "discord-post", "Post to Discord")
  writeSkill(skillsRoot, "health-check", "Run a health check")

  const skills = listSkills(skillsRoot)

  assert.deepEqual(skills.map((skill) => skill.name), ["discord-post", "health-check"])
})

test("projectSkill projects to the claude-code discovery path", () => {
  const skillsRoot = tempDir("openfleet-skills-root-")
  const workdir = tempDir("openfleet-skills-workdir-")
  const skill = loadSkill(writeSkill(skillsRoot, "health-check", "Run a health check"))

  const targetPath = projectSkill(skill, "claude-code", workdir)

  assert.equal(targetPath, path.join(workdir, ".claude", "skills", "health-check", "SKILL.md"))
  assert.equal(fs.readFileSync(targetPath, "utf8"), fs.readFileSync(skill.path, "utf8"))
})

test("projectSkill projects to the opencode discovery path", () => {
  const skillsRoot = tempDir("openfleet-skills-root-")
  const workdir = tempDir("openfleet-skills-workdir-")
  const skill = loadSkill(writeSkill(skillsRoot, "health-check", "Run a health check"))

  const targetPath = projectSkill(skill, "opencode", workdir)

  assert.equal(targetPath, path.join(workdir, ".opencode", "skills", "health-check", "SKILL.md"))
  assert.equal(fs.readFileSync(targetPath, "utf8"), fs.readFileSync(skill.path, "utf8"))
})

test("projectSkill projects to the openclaw discovery path", () => {
  const skillsRoot = tempDir("openfleet-skills-root-")
  const workdir = tempDir("openfleet-skills-workdir-")
  const skill = loadSkill(writeSkill(skillsRoot, "health-check", "Run a health check"))

  const targetPath = projectSkill(skill, "openclaw", workdir)

  assert.equal(targetPath, path.join(workdir, "skills", "health-check", "SKILL.md"))
  assert.equal(fs.readFileSync(targetPath, "utf8"), fs.readFileSync(skill.path, "utf8"))
})

test("projectSkill projects to the codex discovery path", () => {
  const skillsRoot = tempDir("openfleet-skills-root-")
  const workdir = tempDir("openfleet-skills-workdir-")
  const skill = loadSkill(writeSkill(skillsRoot, "health-check", "Run a health check"))

  const targetPath = projectSkill(skill, "codex", workdir)

  assert.equal(targetPath, path.join(workdir, ".agents", "skills", "health-check", "SKILL.md"))
  assert.equal(fs.readFileSync(targetPath, "utf8"), fs.readFileSync(skill.path, "utf8"))
})

test("projectInstructions appends a skill index for harnesses without native skill discovery", () => {
  const deployment = loadExampleDeployment()
  const stateRoot = tempDir("openfleet-skills-state-")
  const workdir = tempDir("openfleet-skills-workdir-")
  const skillsRoot = tempDir("openfleet-skills-root-")

  writeSkill(skillsRoot, "discord-post", "Post to Discord")
  writeSkill(skillsRoot, "health-check", "Run a health check")
  writeAgents(stateRoot, {
    reviewer: {
      name: "reviewer",
      role: "coder",
      skills: ["health-check", "discord-post"],
    },
  })

  const targetPath = projectInstructions("reviewer", "coder", "aider", workdir, deployment, { stateRoot, skillsRoot })
  const instructions = fs.readFileSync(targetPath, "utf8")

  assert.equal(targetPath, path.join(workdir, ".openfleet", "instructions", "aider", "reviewer.md"))
  assert.match(instructions, /# Available Skills/)
  assert.match(instructions, /health-check/)
  assert.match(instructions, /Run a health check/)
  assert.match(instructions, /discord-post/)
  assert.match(instructions, /Post to Discord/)
  assert.equal(fs.existsSync(path.join(workdir, ".claude", "skills", "health-check", "SKILL.md")), false)
})

test("projectAllSkills warns on a missing skill and continues", () => {
  const skillsRoot = tempDir("openfleet-skills-root-")
  const workdir = tempDir("openfleet-skills-workdir-")
  writeSkill(skillsRoot, "health-check", "Run a health check")

  const warnings = []
  const originalWarn = console.warn
  console.warn = (message) => warnings.push(message)

  try {
    projectAllSkills(["missing-skill", "health-check"], "opencode", workdir, skillsRoot)
  } finally {
    console.warn = originalWarn
  }

  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /missing-skill/)
  assert.equal(fs.existsSync(path.join(workdir, ".opencode", "skills", "health-check", "SKILL.md")), true)
})

test("loadSkill throws a validation error when SKILL.md has no frontmatter", () => {
  const skillDir = tempDir("openfleet-skill-invalid-")
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), "# Broken skill\n", "utf8")

  assert.throws(() => loadSkill(skillDir), /frontmatter/i)
})

test("buildSkillIndex renders markdown for available skills", () => {
  const skillsRoot = tempDir("openfleet-skills-root-")
  writeSkill(skillsRoot, "discord-post", "Post to Discord")
  writeSkill(skillsRoot, "health-check", "Run a health check")

  const index = buildSkillIndex(listSkills(skillsRoot))

  assert.match(index, /# Available Skills/)
  assert.match(index, /- `discord-post`: Post to Discord/)
  assert.match(index, /- `health-check`: Run a health check/)
})
