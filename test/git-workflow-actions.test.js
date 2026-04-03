const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { runAction } = require('../core/actions')
const { readEvents } = require('../core/runtime/events')

function tempStateDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openfleet-git-actions-'))
}

test('runAction git_branch creates branch through git executor', () => {
  const calls = []
  const stateDir = tempStateDir()

  const result = runAction({
    type: 'git_branch',
    branch: 'feature/test-branch',
    repo: '/tmp/openfleet',
    source: 'coder',
  }, {
    stateRoot: stateDir,
    exec: (command, args, options) => {
      calls.push({ command, args, options })
      return 'ok'
    },
  })

  assert.equal(result.ok, true)
  assert.equal(calls[0].command, 'git')
  assert.deepEqual(calls[0].args, ['checkout', '-b', 'feature/test-branch'])
  assert.equal(calls[0].options.cwd, '/tmp/openfleet')
  assert.equal(readEvents(stateDir).at(-1).payload.action, 'git_branch')
})

test('runAction git_commit commits staged changes through git executor', () => {
  const calls = []
  const stateDir = tempStateDir()

  const result = runAction({
    type: 'git_commit',
    message: 'Ship bounded fix',
    repo: '/tmp/openfleet',
    source: 'coder',
  }, {
    stateRoot: stateDir,
    exec: (command, args, options) => {
      calls.push({ command, args, options })
      return 'commit-ok'
    },
  })

  assert.equal(result.ok, true)
  assert.equal(calls[0].command, 'git')
  assert.deepEqual(calls[0].args, ['commit', '-m', 'Ship bounded fix'])
  assert.equal(readEvents(stateDir).at(-1).payload.action, 'git_commit')
})

test('runAction github_pr_create opens PR through gh executor', () => {
  const calls = []
  const stateDir = tempStateDir()

  const result = runAction({
    type: 'github_pr_create',
    title: 'Bounded fix',
    body: '## Summary\n- Added tests',
    repo: '/tmp/openfleet',
    source: 'coder',
  }, {
    stateRoot: stateDir,
    exec: (command, args, options) => {
      calls.push({ command, args, options })
      return 'https://github.com/twaldin/openfleet/pull/123\n'
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.url, 'https://github.com/twaldin/openfleet/pull/123')
  assert.equal(calls[0].command, 'gh')
  assert.deepEqual(calls[0].args, ['pr', 'create', '--title', 'Bounded fix', '--body', '## Summary\n- Added tests'])
  assert.equal(readEvents(stateDir).at(-1).payload.action, 'github_pr_create')
})
