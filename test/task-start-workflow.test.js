const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { createTask, getTask, updateTask } = require('../core/runtime/tasks')
const { createWorkflow, advanceWorkflow, getWorkflow } = require('../core/runtime/workflows')

function tempStateDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openfleet-task-workflow-'))
}

test('task can be linked to a workflow and stay active', () => {
  const stateDir = tempStateDir()
  const task = createTask(stateDir, {
    title: 'Implement feature',
    status: 'created',
    assignee: 'cairn',
    channel_binding: 'thread://task-1',
  })

  const workflow = createWorkflow(stateDir, {
    type: 'openfleet-implementation',
    status: 'created',
    steps: ['coder.fix', 'evaluator.review'],
    context: {
      task_id: task.id,
      task_title: task.title,
      channel_binding: task.channel_binding,
    },
  })

  const updatedTask = updateTask(stateDir, task.id, {
    workflow_id: workflow.id,
    status: 'active',
  })
  const advanced = advanceWorkflow(stateDir, workflow.id)

  assert.equal(updatedTask.workflow_id, workflow.id)
  assert.equal(updatedTask.status, 'active')
  assert.equal(getWorkflow(stateDir, workflow.id).current_step, 'coder.fix')
  assert.equal(advanced.current_step, 'coder.fix')
})
