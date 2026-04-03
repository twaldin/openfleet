const { listBlockers, updateBlocker } = require("./runtime/blockers")
const { listApprovals, updateApproval } = require("./runtime/approvals")
const { getTask, updateTask } = require("./runtime/tasks")
const { createEventStore } = require("./runtime/events")

function resolveByChannelContext(stateRoot, { channelBinding, actorId, message }) {
  const eventStore = createEventStore(stateRoot)

  const openApprovals = listApprovals(stateRoot).filter((item) => item.status === "pending" && item.channel_binding === channelBinding)
  if (openApprovals.length) {
    const approval = openApprovals[0]
    const updated = updateApproval(stateRoot, approval.id, {
      status: "approved",
      resolved_by: actorId,
      resolved_at: new Date().toISOString(),
      resolution: message,
    })
    eventStore.append({ type: "approval.updated", agent_id: updated.agent_id || "openfleet", payload: updated })
    return { kind: "approval", object: updated }
  }

  const openBlockers = listBlockers(stateRoot).filter((item) => item.status === "open" && item.channel_binding === channelBinding)
  if (openBlockers.length) {
    const blocker = openBlockers[0]
    const updated = updateBlocker(stateRoot, blocker.id, {
      status: "answered",
      blocked_on_id: actorId,
      resolution: message,
    })
    eventStore.append({ type: "blocker.updated", agent_id: updated.agent_id || "openfleet", payload: updated })
    return { kind: "blocker", object: updated }
  }

  return null
}

function attachBlockerToTask(stateRoot, blocker) {
  if (!blocker.task_id) return null
  const task = getTask(stateRoot, blocker.task_id)
  if (!task) return null
  const blockerIds = Array.from(new Set([...(task.blocker_ids || []), blocker.id]))
  return updateTask(stateRoot, task.id, { blocker_ids: blockerIds })
}

function attachApprovalToTask(stateRoot, approval) {
  if (!approval.task_id) return null
  const task = getTask(stateRoot, approval.task_id)
  if (!task) return null
  const approvalIds = Array.from(new Set([...(task.approval_ids || []), approval.id]))
  return updateTask(stateRoot, task.id, { approval_ids: approvalIds })
}

module.exports = {
  attachApprovalToTask,
  attachBlockerToTask,
  resolveByChannelContext,
}
