const fs = require("fs")
const path = require("path")

function agentsPath(stateDir) {
  return path.join(stateDir, "agents.json")
}

function defaultAgents() {
  return {
    agents: {},
  }
}

function loadAgents(stateDir) {
  try {
    const data = JSON.parse(fs.readFileSync(agentsPath(stateDir), "utf8"))
    return data?.agents && typeof data.agents === "object" ? data.agents : {}
  } catch {
    return defaultAgents().agents
  }
}

function saveAgents(stateDir, agents) {
  fs.mkdirSync(stateDir, { recursive: true })
  fs.writeFileSync(agentsPath(stateDir), `${JSON.stringify({ agents }, null, 2)}\n`)
}

function getAgent(stateDir, name) {
  return loadAgents(stateDir)[name] || null
}

function upsertAgent(stateDir, agent) {
  if (!agent?.name) {
    throw new Error("agent requires name")
  }

  const agents = loadAgents(stateDir)
  const next = {
    ...(agents[agent.name] || {}),
    ...agent,
    name: agent.name,
  }

  agents[agent.name] = next
  saveAgents(stateDir, agents)
  return next
}

function removeAgent(stateDir, name) {
  const agents = loadAgents(stateDir)
  if (!Object.prototype.hasOwnProperty.call(agents, name)) {
    return false
  }

  delete agents[name]
  saveAgents(stateDir, agents)
  return true
}

function listAgents(stateDir) {
  return Object.values(loadAgents(stateDir)).sort((a, b) => a.name.localeCompare(b.name))
}

module.exports = {
  agentsPath,
  getAgent,
  listAgents,
  loadAgents,
  removeAgent,
  saveAgents,
  upsertAgent,
}
