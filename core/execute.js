const { execFileSync } = require("child_process")
const os = require("os")
const path = require("path")
const { createEventStore } = require("./runtime/events")
const { getJob, updateJob } = require("./runtime/jobs")
const { getProfile } = require("./runtime/profiles")
const { executeOpencodeJob } = require("./harness/opencode")
const { executeCodexJob } = require("./harness/codex")
const { getPlaybook } = require("./playbooks")

function executeJob(stateRoot, jobId) {
  const job = getJob(stateRoot, jobId)
  if (!job) throw new Error(`Unknown job: ${jobId}`)
  const profileId = job.output?.selected_profile || job.input?.selected_profile
  if (!profileId) throw new Error(`Job ${jobId} missing selected runtime profile`)
  const profile = getProfile(stateRoot, profileId)
  if (!profile) throw new Error(`Unknown runtime profile: ${profileId}`)

  const prompt = buildJobPrompt(job)
  const eventStore = createEventStore(stateRoot)

  updateJob(stateRoot, jobId, {
    status: "running",
    output: {
      ...(job.output || {}),
      selected_profile: profileId,
      harness: profile.harness,
      host: profile.host || null,
      dispatched_prompt: prompt,
      started_at: new Date().toISOString(),
    },
  })

  let result
  if (job.type === "monitor.detect") {
    result = executeControllerJob({ job, controller: "monitor_scan", args: ["check"] })
  } else if (job.type === "stock-monitor.open" || job.type === "stock-monitor.check") {
    result = executeControllerJob({ job, controller: "stock_monitor_scan", args: [job.type.endsWith('.open') ? 'open' : 'intraday'] })
  } else if (profile.harness === "opencode") {
    result = executeOpencodeJob({ job, profile, prompt, stateRoot })
  } else if (profile.harness === "codex") {
    result = executeCodexJob({ job, profile, prompt, stateRoot })
  } else {
    throw new Error(`Unsupported harness: ${profile.harness}`)
  }

  const updated = updateJob(stateRoot, jobId, {
    status: "dispatched",
    output: {
      ...(job.output || {}),
      selected_profile: profileId,
      harness: profile.harness,
      host: profile.host || null,
      execution: result,
      dispatched_at: new Date().toISOString(),
    },
  })

  eventStore.append({
    type: "job.executed",
    agent_id: job.agent || "openfleet",
    payload: {
      job_id: updated.id,
      selected_profile: profileId,
      harness: profile.harness,
      host: profile.host || null,
    },
  })

  return { job: updated, profile, execution: result }
}

function executeControllerJob({ job, controller, args = [] }) {
  const controllerPath = path.join(process.env.HOME, ".cairn", "system", "bin", controller)
  execFileSync(controllerPath, args, { encoding: "utf8" })
  return {
    ok: true,
    mode: "controller",
    harness: "local-shell",
    host: "macbook",
    agent: job.agent,
    controller,
  }
}

function buildJobPrompt(job) {
  const input = job.input || {}
  const playbook = getPlaybook(job.agent)
  const workflowId = job.workflow_id || 'none'
  const completionHint = [
    'COMPLETION PROTOCOL',
    `- When the job is actually complete, run: node /Users/twaldin/openfleet/bin/report-completion ${job.id} --summary "<one concise summary>" --continue --execute`,
    '- Use a short operational summary.',
    '- Do not claim completion until the requested work is genuinely done.',
  ].join('\n')

  const blockerHint = [
    'BLOCKER PROTOCOL',
    '- If you cannot proceed safely because context is missing, create a blocker instead of guessing.',
    `- Use: node /Users/twaldin/openfleet/bin/task-state blocker create --job ${job.id} --workflow ${workflowId} --agent ${job.agent} --summary "<short blocker summary>" --question "<what you need from the human>" --type human --channel "${input?.context?.channel_binding || ''}"`,
  ].join('\n')
  return [
    `OpenFleet job execution.`,
    `JOB_ID: ${job.id}`,
    `JOB_TYPE: ${job.type}`,
    `WORKFLOW_ID: ${job.workflow_id || "none"}`,
    `You are executing a bounded job assigned to agent role \`${job.agent}\`.`,
    `Use the provided input as the source of truth.`,
    `When complete, return a concise structured response if asked, or complete the requested task directly.`,
    playbook ? `\n${playbook}` : '',
    `\n${completionHint}`,
    `\n${blockerHint}`,
    `Input JSON:`,
    JSON.stringify(input, null, 2),
  ].join("\n")
}

module.exports = {
  executeJob,
}
