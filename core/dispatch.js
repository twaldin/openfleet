const { createEventStore } = require("./runtime/events")
const { createJob, listJobs, updateJob } = require("./runtime/jobs")
const { selectProfile } = require("./runtime/profiles")
const { resolveProject } = require('./runtime/projects')

function dispatchJob(stateRoot, input) {
  const agent = input.agent || null
  enforceSingleActiveJob(stateRoot, agent)
  const project = resolveProject(stateRoot, {
    project_id: input.project_id || input.projectId || input.input?.context?.project_id || null,
    repo: input.repo || input.input?.context?.repo || null,
    context: input.input?.context || {},
  })
  const preferredProfile = input.preferred_profile || input.preferredProfile || project?.default_runtime_profiles?.[input.role] || null

  const selected = selectProfile(stateRoot, {
    allowed: input.allowed_profiles || input.allowedProfiles || [],
    preferred: preferredProfile,
    role: input.role || null,
    harness: input.harness || null,
  })

  if (!selected) {
    throw new Error("No available runtime profile for dispatch")
  }

  const eventStore = createEventStore(stateRoot)
  const job = createJob(stateRoot, {
    type: input.type || "job",
    status: "assigned",
    agent: input.agent || null,
    workflow_id: input.workflow_id || input.workflowId || null,
    trigger: input.trigger || null,
    input: {
      ...(input.input || {}),
      project_id: input.input?.project_id || input.input?.context?.project_id || project?.id || null,
      selected_profile: selected.profile_id,
    },
  })

  const updated = updateJob(stateRoot, job.id, {
    output: {
      selected_profile: selected.profile_id,
      harness: selected.harness,
      host: selected.host || null,
    },
  })

  eventStore.append({
    type: "job.dispatched",
    agent_id: agent || "openfleet",
    payload: {
      job_id: updated.id,
      selected_profile: selected.profile_id,
      harness: selected.harness,
      host: selected.host || null,
    },
  })

  return {
    job: updated,
    profile: selected,
  }
}

function enforceSingleActiveJob(stateRoot, agent) {
  if (!agent) return
  const active = listJobs(stateRoot).find((job) => job.agent === agent && isActiveJob(job.status))
  if (active) {
    throw new Error(`Agent ${agent} already has an active job: ${active.id}`)
  }
}

function isActiveJob(status) {
  return ["queued", "assigned", "running", "dispatched"].includes(status)
}

module.exports = {
  dispatchJob,
}
