const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { resolveProject } = require('../core/runtime/projects')
const { createTask } = require('../core/runtime/tasks')
const { createWorkflow } = require('../core/runtime/workflows')
const { dispatchJob } = require('../core/dispatch')
const { upsertProfile } = require('../core/runtime/profiles')

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

test('createTask and createWorkflow inherit canonical project mapping', () => {
  const stateDir = tempStateDir()
  const task = createTask(stateDir, {
    title: 'Project mapped task',
    source: { repo: 'twaldin/openfleet' },
  })
  const workflow = createWorkflow(stateDir, {
    type: 'openfleet-implementation',
    repo: 'twaldin/openfleet',
    steps: ['coder.fix'],
  })

  assert.equal(task.project_id, 'openfleet')
  assert.equal(task.channel_binding, 'thread://openfleet')
  assert.equal(task.project_host, 'macbook')
  assert.equal(workflow.project_id, 'openfleet')
  assert.equal(workflow.context.repo, 'twaldin/openfleet')
  assert.equal(workflow.context.channel_binding, 'thread://openfleet')
  assert.equal(workflow.context.default_runtime_profiles.coder, 'opencode-gpt54-coder')
})

test('dispatchJob uses project default runtime profile when none is specified', () => {
  const stateDir = tempStateDir()
  upsertProfile(stateDir, {
    profile_id: 'opencode-gpt54-coder',
    harness: 'opencode',
    role: 'coder',
    status: 'available',
  })

  const result = dispatchJob(stateDir, {
    type: 'coder.fix',
    agent: 'coder',
    role: 'coder',
    repo: 'twaldin/openfleet',
    input: { context: { repo: 'twaldin/openfleet' } },
  })

  assert.equal(result.profile.profile_id, 'opencode-gpt54-coder')
  assert.equal(result.job.input.project_id, 'openfleet')
  assert.equal(result.job.input.selected_profile, 'opencode-gpt54-coder')
})
