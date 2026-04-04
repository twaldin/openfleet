const fs = require("fs")
const path = require("path")
const os = require("os")

function defaultStateRoot() {
  return process.env.OPENFLEET_CANONICAL_STATE_DIR || path.join(os.homedir(), ".openfleet")
}

function remoteConfigPath(stateRoot) {
  return path.join(stateRoot || defaultStateRoot(), "remote.json")
}

function loadRemoteConfig(stateRoot) {
  const configPath = remoteConfigPath(stateRoot)
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8"))
  } catch {
    return null
  }
}

function resolveProvider(config) {
  if (!config) return null
  return config.provider || null
}

function resolveEventRouting(config, eventType) {
  const defaults = {
    "agent.post":           { post: true, channel: "auto" },
    "agent.error":          { post: true, channel: "alerts" },
    "agent.blocked":        { post: true, channel: "alerts" },
    "agent.task_completed": { post: true, channel: "auto" },
    "session.spawned":      { post: true, channel: "fleet-status" },
    "session.died":         { post: true, channel: "fleet-status" },
    "agent.respawned":      { post: true, channel: "fleet-status" },
    "agent.compacted":      { post: false },
  }

  const routing = config?.event_routing || {}
  return routing[eventType] || defaults[eventType] || { post: false }
}

function resolveCaptureConfig(config, agentName) {
  const capture = config?.capture || {}
  if (!capture.enabled) return { enabled: false }

  const agentOverride = capture.agents?.[agentName] || {}
  if (agentOverride.enabled === false) return { enabled: false }

  return {
    enabled: true,
    interval: agentOverride.interval || capture.default_interval_seconds || 30,
  }
}

module.exports = {
  defaultStateRoot,
  loadRemoteConfig,
  remoteConfigPath,
  resolveCaptureConfig,
  resolveEventRouting,
  resolveProvider,
}
