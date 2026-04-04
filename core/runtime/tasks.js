const fs = require("fs")
const path = require("path")
const crypto = require("crypto")

const STATUS_ALIASES = {
  created: 'open',
  active: 'in_progress',
  'in-progress': 'in_progress',
  running: 'in_progress',
  done: 'completed',
  awaiting_approval: 'blocked',
}

function tasksPath(stateDir) {
  return path.join(stateDir, "tasks.json")
}

function loadTasks(stateDir) {
  try {
    return JSON.parse(fs.readFileSync(tasksPath(stateDir), "utf8"))
  } catch {
    try {
      const text = fs.readFileSync(tasksPath(stateDir), "utf8")
      const recovered = recoverFirstJsonObject(text)
      return recovered || { tasks: {} }
    } catch {
      return { tasks: {} }
    }
  }
}

function saveTasks(stateDir, data) {
  fs.mkdirSync(stateDir, { recursive: true })
  fs.writeFileSync(tasksPath(stateDir), `${JSON.stringify(data, null, 2)}\n`)
}

function createTask(stateDir, input) {
  const data = loadTasks(stateDir)
  const task = normalizeTask({
    ...input,
    id: input.id || `task_${crypto.randomUUID()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  data.tasks[task.id] = task
  saveTasks(stateDir, data)
  return task
}

function updateTask(stateDir, id, patch) {
  const data = loadTasks(stateDir)
  const current = data.tasks[id]
  if (!current) throw new Error(`Unknown task: ${id}`)
  const next = normalizeTask({
    ...current,
    ...patch,
    id,
    created_at: current.created_at,
    updated_at: new Date().toISOString(),
  })
  data.tasks[id] = next
  saveTasks(stateDir, data)
  return next
}

function getTask(stateDir, id) {
  const task = loadTasks(stateDir).tasks[id]
  return task ? normalizeTask(task) : null
}

function listTasks(stateDir) {
  return Object.values(loadTasks(stateDir).tasks)
    .map((task) => normalizeTask(task))
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
}

function normalizeTask(input = {}) {
  const status = normalizeStatus(input.status)
  const blockedOn = status === 'blocked'
    ? normalizeBlockedOn(input.blocked_on ?? input.blockedOn, input.status)
    : null

  return {
    id: input.id,
    title: input.title || 'task',
    status,
    assignee: input.assignee || null,
    blocked_on: blockedOn,
    created_at: input.created_at || new Date().toISOString(),
    updated_at: input.updated_at || new Date().toISOString(),
  }
}

function normalizeStatus(status) {
  if (!status) return 'open'
  return STATUS_ALIASES[status] || status
}

function normalizeBlockedOn(value, originalStatus) {
  if (value != null && value !== '') return String(value)
  if (originalStatus === 'awaiting_approval') return 'awaiting approval'
  return null
}

function recoverFirstJsonObject(text) {
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (ch === "\\") {
        escaped = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') {
      depth += 1
      continue
    }
    if (ch === '}') {
      depth -= 1
      if (depth === 0) {
        return JSON.parse(text.slice(0, i + 1))
      }
    }
  }
  return null
}

module.exports = {
  createTask,
  getTask,
  listTasks,
  loadTasks,
  saveTasks,
  tasksPath,
  updateTask,
}
