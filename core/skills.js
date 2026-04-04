const fs = require("fs")
const path = require("path")

const NATIVE_SKILL_PATHS = {
  "claude-code": [".claude", "skills"],
  opencode: [".opencode", "skills"],
  openclaw: ["skills"],
  codex: [".agents", "skills"],
}

function skillsRoot(options = {}) {
  return path.resolve(options.skillsRoot || path.join(__dirname, "..", "skills"))
}

function loadSkill(skillDir) {
  if (typeof skillDir !== "string" || !skillDir.trim()) {
    throw new Error("skillDir is required")
  }

  const resolvedDir = path.resolve(skillDir)
  const targetPath = path.join(resolvedDir, "SKILL.md")
  const source = fs.readFileSync(targetPath, "utf8")
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)

  if (!match) {
    throw new Error(`Invalid SKILL.md frontmatter: ${targetPath}`)
  }

  const frontmatter = parseFrontmatter(match[1], targetPath)
  const name = frontmatter.name
  const description = frontmatter.description

  if (typeof name !== "string" || !name.trim()) {
    throw new Error(`Invalid SKILL.md frontmatter: name is required in ${targetPath}`)
  }

  if (typeof description !== "string" || !description.trim()) {
    throw new Error(`Invalid SKILL.md frontmatter: description is required in ${targetPath}`)
  }

  return {
    name: name.trim(),
    description: description.trim(),
    content: match[2].replace(/^\r?\n/, ""),
    path: targetPath,
  }
}

function listSkills(root = skillsRoot()) {
  const resolvedRoot = path.resolve(root)
  if (!fs.existsSync(resolvedRoot)) return []

  return fs.readdirSync(resolvedRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => loadSkill(path.join(resolvedRoot, entry.name)))
    .sort((left, right) => left.name.localeCompare(right.name))
}

function projectSkill(skill, harness, workdir) {
  if (!skill || typeof skill !== "object") {
    throw new Error("skill is required")
  }

  if (typeof harness !== "string" || !harness.trim()) {
    throw new Error("harness is required")
  }

  if (typeof workdir !== "string" || !workdir.trim()) {
    throw new Error("workdir is required")
  }

  const baseSegments = NATIVE_SKILL_PATHS[harness] || null
  if (!baseSegments) return null

  const targetPath = path.join(path.resolve(workdir), ...baseSegments, skill.name, "SKILL.md")
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  fs.copyFileSync(skill.path, targetPath)
  return targetPath
}

function projectAllSkills(skillNames, harness, workdir, root = skillsRoot()) {
  if (!Array.isArray(skillNames)) {
    throw new Error("skillNames must be an array")
  }

  const loadedSkills = []
  const resolvedRoot = path.resolve(root)

  for (const skillName of skillNames) {
    const skillDir = path.join(resolvedRoot, skillName)
    let skill

    try {
      skill = loadSkill(skillDir)
    } catch (error) {
      if (isMissingSkillError(error)) {
        console.warn(`Skipping skill ${skillName}: skill is not defined in ${resolvedRoot}`)
        continue
      }

      throw error
    }

    projectSkill(skill, harness, workdir)
    loadedSkills.push(skill)
  }

  return loadedSkills
}

function buildSkillIndex(skills) {
  if (!Array.isArray(skills) || skills.length === 0) return ""

  const lines = [
    "# Available Skills",
    "",
    "Native skill discovery is unavailable for this harness. Use these shared skills by name:",
    "",
  ]

  for (const skill of skills) {
    lines.push(`- \`${skill.name}\`: ${skill.description}`)
  }

  lines.push("")
  return lines.join("\n")
}

function parseFrontmatter(source, targetPath) {
  const result = {}

  for (const line of source.split(/\r?\n/)) {
    if (!line.trim()) continue
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (!match) {
      throw new Error(`Invalid SKILL.md frontmatter line in ${targetPath}: ${line}`)
    }

    result[match[1]] = stripQuotes(match[2].trim())
  }

  return result
}

function stripQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }

  return value
}

function isMissingSkillError(error) {
  return error && (error.code === "ENOENT" || /ENOENT/.test(error.message))
}

module.exports = {
  buildSkillIndex,
  listSkills,
  loadSkill,
  projectAllSkills,
  projectSkill,
  skillsRoot,
}
