const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { spawnSync } = require("node:child_process")

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

function writeSkill(skillsRoot, name, description = `${name} description`, body = `# ${name}\n\n${name} body\n`) {
  const skillDir = path.join(skillsRoot, name)
  fs.mkdirSync(skillDir, { recursive: true })
  fs.writeFileSync(
    path.join(skillDir, "SKILL.md"),
    `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}`,
    "utf8",
  )
}

function writeHarnessSkill(homeDir, relativeDir, name, description = `${name} description`) {
  const skillsRoot = path.join(homeDir, ...relativeDir)
  writeSkill(skillsRoot, name, description)
}

function runSkillsCli(args, options = {}) {
  return spawnSync("node", [path.join(__dirname, "..", "bin", "skills"), ...args], {
    encoding: "utf8",
    env: { ...process.env, ...options.env },
  })
}

test("scanHarnessSkills finds skills across supported harness directories", () => {
  const homeDir = tempDir("openfleet-skills-home-")
  const { scanHarnessSkills } = require("../core/skills")

  writeHarnessSkill(homeDir, [".claude", "skills"], "claude-skill", "Claude skill")
  writeHarnessSkill(homeDir, [".opencode", "skills"], "opencode-skill", "OpenCode skill")
  writeHarnessSkill(homeDir, [".openclaw", "skills"], "openclaw-skill", "OpenClaw skill")
  writeHarnessSkill(homeDir, [".agents", "skills"], "codex-skill", "Codex skill")

  const scanned = scanHarnessSkills({ homeDir })

  assert.deepEqual(
    scanned.map((skill) => [skill.harness, skill.name]),
    [
      ["claude-code", "claude-skill"],
      ["codex", "codex-skill"],
      ["openclaw", "openclaw-skill"],
      ["opencode", "opencode-skill"],
    ],
  )
})

test("importSkillFromHarness copies SKILL.md into the repo skills root", () => {
  const homeDir = tempDir("openfleet-skills-home-")
  const repoSkillsRoot = tempDir("openfleet-skills-root-")
  const { importSkillFromHarness } = require("../core/skills")

  writeHarnessSkill(homeDir, [".opencode", "skills"], "health-check", "Run a health check")

  const targetPath = importSkillFromHarness("health-check", {
    homeDir,
    skillsRoot: repoSkillsRoot,
  })

  assert.equal(targetPath, path.join(repoSkillsRoot, "health-check", "SKILL.md"))
  assert.match(fs.readFileSync(targetPath, "utf8"), /description: Run a health check/)
})

test("skills CLI scan prints discovered harness skills", () => {
  const homeDir = tempDir("openfleet-skills-home-")

  writeHarnessSkill(homeDir, [".claude", "skills"], "claude-skill", "Claude skill")
  writeHarnessSkill(homeDir, [".agents", "skills"], "codex-skill", "Codex skill")

  const result = runSkillsCli(["scan", "--home", homeDir])

  assert.equal(result.status, 0)
  assert.match(result.stdout, /Importable skills:/)
  assert.match(result.stdout, /claude-skill/)
  assert.match(result.stdout, /codex-skill/)
  assert.match(result.stdout, /claude-code/)
  assert.match(result.stdout, /codex/)
})

test("skills CLI list shows repo and importable skills", () => {
  const homeDir = tempDir("openfleet-skills-home-")
  const repoSkillsRoot = tempDir("openfleet-skills-root-")

  writeSkill(repoSkillsRoot, "repo-skill", "Repo skill")
  writeHarnessSkill(homeDir, [".openclaw", "skills"], "home-skill", "Home skill")

  const result = runSkillsCli(["list", "--home", homeDir, "--skills-root", repoSkillsRoot])

  assert.equal(result.status, 0)
  assert.match(result.stdout, /OpenFleet skills:/)
  assert.match(result.stdout, /repo-skill/)
  assert.match(result.stdout, /Importable skills:/)
  assert.match(result.stdout, /home-skill/)
  assert.match(result.stdout, /openclaw/)
})

test("skills CLI import copies a scanned skill into the repo skills root", () => {
  const homeDir = tempDir("openfleet-skills-home-")
  const repoSkillsRoot = tempDir("openfleet-skills-root-")

  writeHarnessSkill(homeDir, [".claude", "skills"], "incident-review", "Review an incident")

  const result = runSkillsCli(["import", "incident-review", "--home", homeDir, "--skills-root", repoSkillsRoot])

  assert.equal(result.status, 0)
  assert.match(result.stdout, /Imported incident-review/)
  assert.equal(fs.existsSync(path.join(repoSkillsRoot, "incident-review", "SKILL.md")), true)
})

test("openfleet CLI exposes the skills command in its command table and help text", () => {
  const { commands, renderHelp } = require("../bin/openfleet")

  assert.equal(typeof commands.skills, "function")
  assert.match(renderHelp(), /skills \[args\]\s+Shared skill management/)
})
