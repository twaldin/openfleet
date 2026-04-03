const fs = require("fs")
const os = require("os")
const path = require("path")
const { normalizeRouting } = require("./routing")

function resolvePath(baseDir, value) {
  if (!value) return value
  if (path.isAbsolute(value)) return value
  return path.resolve(baseDir, value)
}

function normalizeJob(job) {
  if (typeof job === "string") return { prompt: job }
  if (Array.isArray(job)) return { prompt: job.join("\n") }
  if (!job || typeof job !== "object") return null

  const prompt = Array.isArray(job.prompt)
    ? job.prompt.join("\n")
    : typeof job.prompt === "string"
      ? job.prompt
      : ""

  return {
    ...job,
    prompt,
  }
}

function loadDeploymentConfig(configPath) {
  const resolved = path.resolve(configPath)
  const configDir = path.dirname(resolved)
  const parsed = JSON.parse(fs.readFileSync(resolved, "utf8"))

  const workspaceRoot = resolvePath(configDir, parsed.workspaceRoot || parsed.runtime?.workspaceRoot || os.homedir())
  const stateDir = resolvePath(
    configDir,
    parsed.runtime?.stateDir || parsed.stateDir || path.join(os.homedir(), ".openfleet"),
  )

  const deployment = {
    ...parsed,
    configPath: resolved,
    configDir,
    deploymentId: parsed.deployment_id || parsed.deploymentId || `dep_${parsed.name || path.basename(configDir)}`,
    name: parsed.name || path.basename(configDir),
    workspaceRoot,
    runtime: {
      host: parsed.runtime?.host || process.env.OPENFLEET_HOST || `${process.platform}-${process.arch}`,
      stateDir,
    },
    server: {
      host: parsed.server?.host || process.env.OPENFLEET_SERVER_HOST || process.env.OPENCODE_SERVER_HOST || "127.0.0.1",
      port: String(parsed.server?.port || process.env.OPENFLEET_SERVER_PORT || process.env.OPENCODE_SERVER_PORT || "4096"),
      stateDir: resolvePath(configDir, parsed.server?.stateDir || path.join(os.homedir(), ".openfleet", "system", "opencode")),
      logDir: resolvePath(configDir, parsed.server?.logDir || path.join(os.homedir(), ".openfleet", "system", "logs")),
    },
    parent: {
      agent: parsed.parent?.agent || "orchestrator",
      sessionScript: resolvePath(configDir, parsed.parent?.sessionScript || ""),
    },
    routing: normalizeRouting(parsed.routing || {}),
    jobs: Object.fromEntries(
      Object.entries(parsed.jobs || {}).map(([name, job]) => [name, normalizeJob(job)]),
    ),
  }

  if (!deployment.parent.sessionScript) {
    throw new Error(`deployment.parent.sessionScript is required in ${resolved}`)
  }

  return deployment
}

function getDeploymentJob(deployment, jobName) {
  const job = deployment.jobs[jobName]
  if (!job) {
    throw new Error(`Unknown job ${jobName} in ${deployment.configPath}`)
  }
  if (!job.prompt) {
    throw new Error(`Job ${jobName} is missing a prompt`)
  }
  return job
}

function readPromptFromArgs(argv) {
  const prompt = argv.join(" ").trim()
  if (prompt) return prompt
  try {
    return fs.readFileSync(0, "utf8").trim()
  } catch {
    return ""
  }
}

module.exports = {
  getDeploymentJob,
  loadDeploymentConfig,
  normalizeJob,
  readPromptFromArgs,
  resolvePath,
}
