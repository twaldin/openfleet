const { createEventStore } = require("./events")
const { getTask, updateTask } = require("./tasks")
const { getBlocker, listBlockers, updateBlocker } = require("./blockers")
const { getApproval, listApprovals, updateApproval } = require("./approvals")
const { getWorkflow, resumeWorkflow, updateWorkflow } = require("./workflows")

function resolveLatestByChannel(stateDir, kind, channelBinding, patch) {
  const items = kind === "blocker" ? listBlockers(stateDir) : listApprovals(stateDir)
  const open = items.filter((item) => item.channel_binding === channelBinding && (item.status === "open" || item.status === "pending"))
  if (!open.length) {
    throw new Error(`No open ${kind} for channel ${channelBinding}`)
  }
  open.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
  const current = open[0]
  if (kind === "blocker") {
    return resolveBlocker(stateDir, current.id, patch)
  }
  return resolveApproval(stateDir, current.id, patch)
}

function resolveBlocker(stateDir, blockerId, patch = {}) {
  const blocker = getBlocker(stateDir, blockerId)
  if (!blocker) throw new Error(`Unknown blocker: ${blockerId}`)
  const updated = updateBlocker(stateDir, blockerId, {
    status: patch.status || "cleared",
    answer: patch.answer || null,
    resolved_by: patch.resolved_by || null,
    resolved_at: new Date().toISOString(),
  })

  let task = null
  if (blocker.task_id) {
    task = getTask(stateDir, blocker.task_id)
    if (task) {
      const remaining = (task.blocker_ids || []).filter((id) => id !== blockerId)
      task = updateTask(stateDir, blocker.task_id, {
        blocker_ids: remaining,
        status: remaining.length === 0 && task.status === "blocked" ? "active" : task.status,
      })
    }
  }

  let workflow = null
  if (blocker.workflow_id) {
    const current = getWorkflow(stateDir, blocker.workflow_id)
    if (current) {
      workflow = current.status === 'paused'
        ? resumeWorkflow(stateDir, blocker.workflow_id, { resumed_by: patch.resolved_by || null })
        : updateWorkflow(stateDir, blocker.workflow_id, { status: "active" })
    }
  }

  const eventStore = createEventStore(stateDir)
  eventStore.append({ type: "blocker.resolved", agent_id: blocker.agent_id || "openfleet", payload: updated })
  if (workflow) {
    eventStore.append({ type: "workflow.unblocked", agent_id: workflow.current_step || "openfleet", payload: workflow })
  }

  return { blocker: updated, task, workflow }
}

function resolveApproval(stateDir, approvalId, patch = {}) {
  const approval = getApproval(stateDir, approvalId)
  if (!approval) throw new Error(`Unknown approval: ${approvalId}`)
  const status = patch.status || "approved"
  const updated = updateApproval(stateDir, approvalId, {
    status,
    resolution: patch.resolution || null,
    resolved_by: patch.resolved_by || null,
    resolved_at: new Date().toISOString(),
  })

  let task = null
  if (approval.task_id) {
    task = getTask(stateDir, approval.task_id)
    if (task) {
      const remaining = (task.approval_ids || []).filter((id) => id !== approvalId)
      task = updateTask(stateDir, approval.task_id, {
        approval_ids: remaining,
        status: status === "approved" && remaining.length === 0 && task.status === "awaiting_approval" ? "active" : task.status,
      })
    }
  }

  let workflow = null
  if (approval.workflow_id) {
    const current = getWorkflow(stateDir, approval.workflow_id)
    if (current) {
      workflow = status === 'approved'
        ? (current.status === 'paused'
          ? resumeWorkflow(stateDir, approval.workflow_id, { resumed_by: patch.resolved_by || null })
          : updateWorkflow(stateDir, approval.workflow_id, { status: 'active' }))
        : updateWorkflow(stateDir, approval.workflow_id, { status: 'blocked' })
    }
  }

  const eventStore = createEventStore(stateDir)
  eventStore.append({ type: "approval.resolved", agent_id: approval.agent_id || "openfleet", payload: updated })
  if (workflow && status === "approved") {
    eventStore.append({ type: "workflow.unblocked", agent_id: workflow.current_step || "openfleet", payload: workflow })
  }

  return { approval: updated, task, workflow }
}

module.exports = {
  resolveApproval,
  resolveBlocker,
  resolveLatestByChannel,
}
