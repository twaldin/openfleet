const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { resolveProject } = require('../core/runtime/projects')

function tempStateDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openfleet-projects-'))
  // Seed with a project config so tests don't depend on hardcoded defaults
  fs.writeFileSync(path.join(dir, 'projects.json'), JSON.stringify({
    projects: {
      openfleet: {
        id: 'openfleet',
        repo: 'twaldin/openfleet',
        channel_binding: 'thread://openfleet',
        host: 'macbook',
        default_runtime_profiles: { coder: 'opencode-gpt54-coder' }
      }
    }
  }))
  return dir
}

test('resolveProject maps repo to canonical project object', () => {
  const stateDir = tempStateDir()
  const project = resolveProject(stateDir, { repo: 'twaldin/openfleet' })

  assert.equal(project.id, 'openfleet')
  assert.equal(project.channel_binding, 'thread://openfleet')
  assert.equal(project.host, 'macbook')
  assert.equal(project.default_runtime_profiles.coder, 'opencode-gpt54-coder')
})

