const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const repoRoot = path.join(__dirname, "..")

test("package.json exposes npm publish metadata for openfleet", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"))

  assert.equal(pkg.name, "openfleet")
  assert.equal(pkg.version, "1.0.0")
  assert.equal(pkg.description, "Harness-agnostic AI agent orchestrator")
  assert.deepEqual(pkg.bin, { openfleet: "./bin/openfleet" })
  assert.deepEqual(pkg.files, ["bin/", "core/", "lib/", "skills/", "internal/"])
  assert.deepEqual(pkg.keywords, ["ai", "agent", "orchestrator", "claude", "opencode", "openclaw", "mcp"])
  assert.equal(pkg.license, "MIT")
  assert.deepEqual(pkg.repository, {
    type: "git",
    url: "git+https://github.com/twaldin/openfleet.git",
  })
  assert.equal(pkg.homepage, "https://github.com/twaldin/openfleet#readme")
  assert.deepEqual(pkg.bugs, {
    url: "https://github.com/twaldin/openfleet/issues",
  })
  assert.deepEqual(pkg.engines, { node: ">=20" })
})

test("bin/openfleet is a node executable", () => {
  const entrypoint = path.join(repoRoot, "bin", "openfleet")
  const content = fs.readFileSync(entrypoint, "utf8")
  const stats = fs.statSync(entrypoint)

  assert.match(content, /^#!\/usr\/bin\/env node\n/)
  assert.notEqual(stats.mode & 0o111, 0)
})

test(".npmignore excludes development-only directories", () => {
  const npmignore = fs.readFileSync(path.join(repoRoot, ".npmignore"), "utf8")

  assert.match(npmignore, /^test\/$/m)
  assert.match(npmignore, /^\.github\/$/m)
  assert.match(npmignore, /^docs\/$/m)
  assert.match(npmignore, /^examples\/$/m)
})
