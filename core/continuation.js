const { listTasks } = require("./runtime/tasks")

function decideContinuation(stateDir, options = {}) {
  const source = options.source || null
  const tasks = listTasks(stateDir)
  const openTasks = tasks.filter((task) => task.status === 'open')
  const inProgressTasks = tasks.filter((task) => task.status === 'in_progress')
  const blockedTasks = tasks.filter((task) => task.status === 'blocked')
  const completedTasks = tasks.filter((task) => task.status === 'completed')

  if (openTasks.length > 0) {
    return {
      decision: "continue",
      reason: "open_tasks_exist",
      source,
      counts: summarize(openTasks, inProgressTasks, blockedTasks, completedTasks),
    }
  }

  if (inProgressTasks.length > 0) {
    return {
      decision: "wait",
      reason: "work_in_progress",
      source,
      counts: summarize(openTasks, inProgressTasks, blockedTasks, completedTasks),
    }
  }

  if (blockedTasks.length > 0) {
    return {
      decision: "wait",
      reason: "blocked_tasks_exist",
      source,
      counts: summarize(openTasks, inProgressTasks, blockedTasks, completedTasks),
    }
  }

  if (tasks.length === 0 || completedTasks.length === tasks.length) {
    return {
      decision: "stop",
      reason: "all_work_complete",
      source,
      counts: summarize(openTasks, inProgressTasks, blockedTasks, completedTasks),
    }
  }

  return {
    decision: "wait",
    reason: "no_runnable_work",
    source,
    counts: summarize(openTasks, inProgressTasks, blockedTasks, completedTasks),
  }
}

function summarize(openTasks, inProgressTasks, blockedTasks, completedTasks) {
  return {
    open_tasks: openTasks.length,
    in_progress_tasks: inProgressTasks.length,
    blocked_tasks: blockedTasks.length,
    completed_tasks: completedTasks.length,
  }
}

module.exports = {
  decideContinuation,
}
