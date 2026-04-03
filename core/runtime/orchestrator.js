const fs = require("fs")
const path = require("path")

function orchestratorPath(stateDir) {
  return path.join(stateDir, "orchestrator.json")
}

function saveActiveOrchestrator(stateDir, payload) {
  fs.mkdirSync(stateDir, { recursive: true })
  fs.writeFileSync(orchestratorPath(stateDir), `${JSON.stringify(payload, null, 2)}\n`)
}

function loadActiveOrchestrator(stateDir) {
  try {
    return JSON.parse(fs.readFileSync(orchestratorPath(stateDir), "utf8"))
  } catch {
    return null
  }
}

module.exports = {
  orchestratorPath,
  saveActiveOrchestrator,
  loadActiveOrchestrator,
}
