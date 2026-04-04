const fs = require("fs")
const path = require("path")
const crypto = require("crypto")

function jobsPath(stateDir) {
  return path.join(stateDir, "jobs.json")
}

function loadJobs(stateDir) {
  try {
    return JSON.parse(fs.readFileSync(jobsPath(stateDir), "utf8"))
  } catch {
    return { jobs: {} }
  }
}

function saveJobs(stateDir, data) {
  fs.mkdirSync(stateDir, { recursive: true })
  fs.writeFileSync(jobsPath(stateDir), `${JSON.stringify(data, null, 2)}\n`)
}

function createJob(stateDir, input) {
  const data = loadJobs(stateDir)
  const id = input.id || `job_${crypto.randomUUID()}`
  const now = new Date().toISOString()
  const job = {
    id,
    type: input.type || "task",
    status: input.status || "queued",
    agent: input.agent || null,
    trigger: input.trigger || null,
    input: input.input || null,
    output: input.output || null,
    created_at: now,
    updated_at: now,
  }
  data.jobs[id] = job
  saveJobs(stateDir, data)
  return job
}

function updateJob(stateDir, id, patch) {
  const data = loadJobs(stateDir)
  const current = data.jobs[id]
  if (!current) throw new Error(`Unknown job: ${id}`)
  const next = {
    ...current,
    ...patch,
    id,
    updated_at: new Date().toISOString(),
  }
  data.jobs[id] = next
  saveJobs(stateDir, data)
  return next
}

function getJob(stateDir, id) {
  return loadJobs(stateDir).jobs[id] || null
}

function listJobs(stateDir) {
  return Object.values(loadJobs(stateDir).jobs).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
}

module.exports = {
  createJob,
  getJob,
  jobsPath,
  listJobs,
  loadJobs,
  saveJobs,
  updateJob,
}
