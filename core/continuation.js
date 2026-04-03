const { listJobs } = require("./runtime/jobs")
const { listWorkflows } = require("./runtime/workflows")
const { listBlockers } = require("./runtime/blockers")
const { listApprovals } = require("./runtime/approvals")

function decideContinuation(stateDir, options = {}) {
  const source = options.source || null
  const jobs = listJobs(stateDir)
  const workflows = listWorkflows(stateDir)
  const blockers = listBlockers(stateDir).filter((item) => item.status === "open")
  const approvals = listApprovals(stateDir).filter((item) => item.status === "pending")

  const runnableJobs = jobs.filter((job) => ["queued", "assigned"].includes(job.status))
  const runningJobs = jobs.filter((job) => ["running", "dispatched"].includes(job.status))
  const activeWorkflows = workflows.filter((wf) => wf.status === "active")
  const blockedWorkflows = workflows.filter((wf) => wf.status === "blocked")
  const approvalPausedWorkflows = workflows.filter((wf) => wf.status === "awaiting_approval")
  const pausedWorkflows = workflows.filter((wf) => wf.status === "paused")

  if (runnableJobs.length > 0) {
    return {
      decision: "continue",
      reason: "runnable_jobs_exist",
      source,
      counts: summarize(runnableJobs, runningJobs, activeWorkflows, blockedWorkflows, approvalPausedWorkflows, pausedWorkflows, blockers, approvals),
    }
  }

  if (activeWorkflows.length > 0 && runningJobs.length > 0) {
    return {
      decision: "wait",
      reason: "work_in_progress",
      source,
      counts: summarize(runnableJobs, runningJobs, activeWorkflows, blockedWorkflows, approvalPausedWorkflows, pausedWorkflows, blockers, approvals),
    }
  }

  if (pausedWorkflows.length > 0) {
    return {
      decision: 'wait',
      reason: 'paused_workflows',
      source,
      counts: summarize(runnableJobs, runningJobs, activeWorkflows, blockedWorkflows, approvalPausedWorkflows, pausedWorkflows, blockers, approvals),
    }
  }

  if (blockers.length > 0 || approvals.length > 0 || blockedWorkflows.length > 0 || approvalPausedWorkflows.length > 0) {
    return {
      decision: "wait",
      reason: "blocked_or_awaiting_approval",
      source,
      counts: summarize(runnableJobs, runningJobs, activeWorkflows, blockedWorkflows, approvalPausedWorkflows, pausedWorkflows, blockers, approvals),
    }
  }

  return {
    decision: "wait",
    reason: "no_runnable_work",
    source,
    counts: summarize(runnableJobs, runningJobs, activeWorkflows, blockedWorkflows, approvalPausedWorkflows, pausedWorkflows, blockers, approvals),
  }
}

function summarize(runnableJobs, runningJobs, activeWorkflows, blockedWorkflows, approvalPausedWorkflows, pausedWorkflows, blockers, approvals) {
  return {
    runnable_jobs: runnableJobs.length,
    running_jobs: runningJobs.length,
    active_workflows: activeWorkflows.length,
    blocked_workflows: blockedWorkflows.length,
    approval_paused_workflows: approvalPausedWorkflows.length,
    paused_workflows: pausedWorkflows.length,
    open_blockers: blockers.length,
    pending_approvals: approvals.length,
  }
}

module.exports = {
  decideContinuation,
}
