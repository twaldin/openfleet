const test = require('node:test')
const assert = require('node:assert/strict')

const { envelopeSystemMessage } = require('../core/envelope')
const { executeOpencodeJob } = require('../core/harness/opencode')
const { executeCodexJob } = require('../core/harness/codex')

test('envelopeSystemMessage formats system-targeted envelope', () => {
  assert.equal(
    envelopeSystemMessage('coder-gpt', 'Run this job'),
    '[SYSTEM]: [CODER-GPT]: Run this job',
  )
})

test('executeOpencodeJob sends enveloped programmatic prompt to worker agent', () => {
  const calls = []

  executeOpencodeJob({
    job: { agent: 'coder' },
    profile: { profile_id: 'opencode-gpt54-coder', host: 'macbook' },
    prompt: 'OpenFleet job execution.',
    exec: (command, args) => {
      calls.push({ command, args })
      return ''
    },
  })

  assert.match(calls[0].args[3], /^\[SYSTEM\]: \[CODER\]: OpenFleet job execution\./)
})

test('executeCodexJob sends enveloped system prompt to orchestrator', () => {
  const calls = []

  executeCodexJob({
    job: { agent: 'cairn' },
    profile: { host: 'macbook' },
    prompt: 'Dispatch a workflow.',
    exec: (command, args) => {
      calls.push({ command, args })
      return '{}'
    },
  })

  assert.deepEqual(calls[0].args.slice(-2), ['--message', '[SYSTEM]: [CAIRN]: Dispatch a workflow.'])
})
