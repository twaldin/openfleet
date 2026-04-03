const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const { resolveProject } = require('./projects')

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
  const id = input.id || `task_${crypto.randomUUID()}`
  const now = new Date().toISOString()
  const project = resolveProject(stateDir, input)
  const task = {
    id,
    title: input.title || "task",
    source: input.source || null,
    project_id: input.project_id || input.projectId || project?.id || null,
    repo: input.repo || input.source?.repo || project?.repo || null,
    status: input.status || "created",
    assignee: input.assignee || null,
    workflow_id: input.workflow_id || input.workflowId || null,
    blocker_ids: input.blocker_ids || [],
    approval_ids: input.approval_ids || [],
    channel_binding: input.channel_binding || input.channelBinding || project?.channel_binding || null,
    project_host: input.project_host || project?.host || null,
    default_runtime_profiles: input.default_runtime_profiles || project?.default_runtime_profiles || null,
    created_at: now,
    updated_at: now,
  }
  data.tasks[id] = task
  saveTasks(stateDir, data)
  return task
}

function updateTask(stateDir, id, patch) {
  const data = loadTasks(stateDir)
  const current = data.tasks[id]
  if (!current) throw new Error(`Unknown task: ${id}`)
  const next = {
    ...current,
    ...patch,
    id,
    updated_at: new Date().toISOString(),
  }
  data.tasks[id] = next
  saveTasks(stateDir, data)
  return next
}

function getTask(stateDir, id) {
  return loadTasks(stateDir).tasks[id] || null
}

function listTasks(stateDir) {
  return Object.values(loadTasks(stateDir).tasks).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
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
  saveTasks,
  tasksPath,
  updateTask,
}
