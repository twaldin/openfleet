const { createEventStore } = require("./runtime/events")
const { runActions } = require("./actions")

function runTaskPipeline({ taskId, source, payloadFile = null, summary = "", shouldPost = false, postChannel = null, postMessage = null, shouldIssue = false, createWorkflow = null, createJob = null, stateRoot }) {
  const eventStore = createEventStore(stateRoot)
  eventStore.append({
    type: "task.completed",
    agent_id: source,
    payload: {
      task_id: taskId,
      summary,
      payload_file: payloadFile,
    },
  })

  const actions = [
    {
      type: "parent_message",
      sender: source,
      message: summary,
    },
  ]

  let workflowId = createJob?.workflowId || null

  if (createWorkflow) {
    const [workflowAction] = runActions([
      {
        type: "workflow_create",
        source,
        workflowType: createWorkflow.type,
        status: createWorkflow.status,
        steps: createWorkflow.steps,
        context: createWorkflow.context,
      },
    ], { source, payloadFile, summary, stateRoot })
    actions.push(workflowAction)
    workflowId = workflowAction?.workflow?.id || workflowId
  }

  if (createJob) {
    const [jobAction] = runActions([
      {
        type: "job_create",
        source,
        jobType: createJob.type,
        status: createJob.status,
        agent: createJob.agent,
        trigger: createJob.trigger,
        input: createJob.input,
        workflowId,
      },
    ], { source, payloadFile, summary, stateRoot, workflowId })
    actions.push(jobAction)
  }

  if (shouldPost && postChannel && postMessage) {
    actions.push({
      type: "discord_post",
      source,
      channel: postChannel,
      message: postMessage,
    })
  }

  if (shouldIssue && payloadFile) {
    actions.push({
      type: "github_issue_upsert",
      source,
      payloadFile,
    })
  }

  const baseActions = actions.filter((action) => !["workflow_create", "job_create"].includes(action.type))
  const baseRun = runActions(baseActions, { source, payloadFile, summary, stateRoot })

  return {
    ok: true,
    taskId,
    source,
    actions: [...actions.filter((action) => ["workflow_create", "job_create"].includes(action.type)), ...baseRun],
  }
}

module.exports = {
  runTaskPipeline,
}
