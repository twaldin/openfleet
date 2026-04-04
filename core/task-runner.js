const { createEventStore } = require("./runtime/events")
const { runActions } = require("./actions")

function runTaskPipeline({ taskId, source, payloadFile = null, summary = "", shouldPost = false, postChannel = null, postMessage = null, shouldIssue = false, createJob = null, stateRoot }) {
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
      },
    ], { source, payloadFile, summary, stateRoot })
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

  const baseActions = actions.filter((action) => action.type !== "job_create")
  const baseRun = runActions(baseActions, { source, payloadFile, summary, stateRoot })

  return {
    ok: true,
    taskId,
    source,
    actions: [...actions.filter((action) => action.type === "job_create"), ...baseRun],
  }
}

module.exports = {
  runTaskPipeline,
}
