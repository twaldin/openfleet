const test = require('node:test')
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { createWorkflow, getWorkflow, pauseWorkflow, resumeWorkflow } = require('../core/runtime/workflows')
const { dispatchJob } = require('../core/dispatch')
const { upsertProfile } = require('../core/runtime/profiles')
const { updateJob, getJob } = require('../core/runtime/jobs')

function tempStateDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openfleet-workflow-continue-'))
}

function runReportCompletion(stateDir, jobId, extraArgs = []) {
  return JSON.parse(execFileSync('node', [
    path.join(__dirname, '..', 'bin', 'report-completion'),
    jobId,
    '--state-root',
    stateDir,
    ...extraArgs,
  ], { encoding: 'utf8' }))
}

test('dispatch selects first workflow step profile', () => {
  const stateDir = tempStateDir()
  upsertProfile(stateDir, {
    profile_id: 'opencode-qwen32b-coder',
    harness: 'opencode',
    role: 'coder',
    status: 'available',
  })

  const result = dispatchJob(stateDir, {
    type: 'coder.fix',
    agent: 'coder',
    role: 'coder',
    workflow_id: 'wf_test',
    input: { step: 'coder.fix' },
  })

  assert.equal(result.profile.profile_id, 'opencode-qwen32b-coder')
  assert.equal(result.job.input.selected_profile, 'opencode-qwen32b-coder')
})

test('dispatch honors preferred GPT coder profile when available', () => {
  const stateDir = tempStateDir()
  upsertProfile(stateDir, {
    profile_id: 'opencode-qwen32b-coder',
    harness: 'opencode',
    role: 'coder',
    status: 'available',
  })
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
    preferred_profile: 'opencode-gpt54-coder',
    workflow_id: 'wf_test',
    input: { step: 'coder.fix' },
  })

  assert.equal(result.profile.profile_id, 'opencode-gpt54-coder')
  assert.equal(result.job.input.selected_profile, 'opencode-gpt54-coder')
  assert.equal(result.job.output.selected_profile, 'opencode-gpt54-coder')
})

test('dispatch blocks assigning a second active job to the same agent', () => {
  const stateDir = tempStateDir()
  upsertProfile(stateDir, {
    profile_id: 'opencode-gpt54-coder',
    harness: 'opencode',
    role: 'coder',
    status: 'available',
  })

  dispatchJob(stateDir, {
    type: 'coder.fix',
    agent: 'coder',
    role: 'coder',
    preferred_profile: 'opencode-gpt54-coder',
    workflow_id: 'wf_first',
    input: { step: 'coder.fix' },
  })

  assert.throws(() => {
    dispatchJob(stateDir, {
      type: 'coder.fix',
      agent: 'coder',
      role: 'coder',
      preferred_profile: 'opencode-gpt54-coder',
      workflow_id: 'wf_second',
      input: { step: 'coder.fix' },
    })
  }, /Agent coder already has an active job/)
})

test('manual job completion leaves workflow at next step when advanced', () => {
  const stateDir = tempStateDir()
  upsertProfile(stateDir, {
    profile_id: 'opencode-qwen32b-coder',
    harness: 'opencode',
    role: 'coder',
    status: 'available',
  })
  const wf = createWorkflow(stateDir, {
    type: 'remediation',
    status: 'active',
    current_step: 'coder.fix',
    steps: ['monitor.detect', 'coder.fix', 'evaluator.review'],
    context: {},
  })
  const job = dispatchJob(stateDir, {
    type: 'coder.fix',
    agent: 'coder',
    role: 'coder',
    workflow_id: wf.id,
    input: { step: 'coder.fix' },
  }).job
  const completed = updateJob(stateDir, job.id, {
    status: 'completed',
    output: { summary: 'done' },
  })

  assert.equal(getJob(stateDir, completed.id).status, 'completed')
  assert.equal(getWorkflow(stateDir, wf.id).current_step, 'coder.fix')
})

test('workflow pause and resume are first-class state transitions', () => {
  const stateDir = tempStateDir()
  const workflow = createWorkflow(stateDir, {
    type: 'remediation',
    status: 'active',
    current_step: 'coder.fix',
    steps: ['coder.fix', 'evaluator.review'],
    context: {},
  })

  const paused = pauseWorkflow(stateDir, workflow.id, {
    reason: 'waiting on human answer',
    paused_by: 'coder',
  })
  const resumed = resumeWorkflow(stateDir, workflow.id, {
    resumed_by: 'user_tim',
  })

  assert.equal(paused.status, 'paused')
  assert.equal(paused.pause_reason, 'waiting on human answer')
  assert.equal(paused.paused_by, 'coder')
  assert.equal(paused.previous_status, 'active')
  assert.equal(resumed.status, 'active')
  assert.equal(resumed.pause_reason, null)
  assert.equal(resumed.paused_by, null)
  assert.equal(resumed.resumed_by, 'user_tim')
  assert.equal(resumed.previous_status, null)
})

test('report-completion auto-continues workflow to next job', () => {
  const stateDir = tempStateDir()
  upsertProfile(stateDir, {
    profile_id: 'opencode-gpt54-coder',
    harness: 'opencode',
    role: 'coder',
    status: 'available',
  })
  upsertProfile(stateDir, {
    profile_id: 'opencode-gptmini-evaluator',
    harness: 'opencode',
    role: 'evaluator',
    status: 'available',
  })
  const workflow = createWorkflow(stateDir, {
    type: 'remediation',
    status: 'active',
    current_step: 'coder.fix',
    steps: ['coder.fix', 'evaluator.review'],
    context: { task_id: 'task_test', repo: 'openfleet' },
  })
  const job = dispatchJob(stateDir, {
    type: 'coder.fix',
    agent: 'coder',
    role: 'coder',
    preferred_profile: 'opencode-gpt54-coder',
    workflow_id: workflow.id,
    input: { step: 'coder.fix', workflow_id: workflow.id, context: workflow.context },
  }).job

  const result = runReportCompletion(stateDir, job.id, ['--summary', 'done', '--continue'])

  assert.equal(result.job.status, 'completed')
  assert.equal(result.workflow.current_step, 'evaluator.review')
  assert.equal(result.next.job.type, 'evaluator.review')
  assert.equal(result.next.job.input.previous_job_id, job.id)
  assert.equal(result.next.job.input.previous_summary, 'done')
})

test('report-completion marks task complete when workflow finishes', () => {
  const stateDir = tempStateDir()
  upsertProfile(stateDir, {
    profile_id: 'opencode-gpt54-coder',
    harness: 'opencode',
    role: 'coder',
    status: 'available',
  })
  const { createTask, getTask } = require('../core/runtime/tasks')
  const task = createTask(stateDir, {
    id: 'task_finish',
    title: 'Finish workflow',
    status: 'active',
    workflow_id: 'wf_finish',
  })
  const workflow = createWorkflow(stateDir, {
    id: 'wf_finish',
    type: 'remediation',
    status: 'active',
    current_step: 'coder.fix',
    steps: ['coder.fix'],
    context: { task_id: task.id, repo: 'openfleet' },
  })
  const job = dispatchJob(stateDir, {
    type: 'coder.fix',
    agent: 'coder',
    role: 'coder',
    preferred_profile: 'opencode-gpt54-coder',
    workflow_id: workflow.id,
    input: { step: 'coder.fix', workflow_id: workflow.id, context: workflow.context },
  }).job

  const result = runReportCompletion(stateDir, job.id, ['--summary', 'done', '--continue'])

  assert.equal(result.next, null)
  assert.equal(result.workflow.status, 'completed')
  assert.equal(getTask(stateDir, task.id).status, 'completed')
})
