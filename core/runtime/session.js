const fs = require("fs")
const path = require("path")
const { execFileSync } = require("child_process")
const { ensureOpencodeServer, request } = require("../../lib/opencode")
const { saveRegistry, loadRegistry, upsertSession } = require("./registry")

function legacySessionPath(stateDir, name) {
  return path.join(stateDir, `${name}.json`)
}

function sessionDir(stateDir) {
  return path.join(stateDir, "sessions")
}

function sessionPath(stateDir, name) {
  return path.join(sessionDir(stateDir), `${name}.json`)
}

function loadSessionMetadata(stateDir, name) {
  const primary = sessionPath(stateDir, name)
  const legacy = legacySessionPath(stateDir, name)

  for (const filePath of [primary, legacy]) {
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf8"))
    } catch {
      // try next path
    }
  }

  return null
}

function saveSessionMetadata(stateDir, metadata) {
  if (!metadata?.name) {
    throw new Error("session metadata requires a name")
  }

  const next = {
    ...metadata,
    updated_at: metadata.updated_at || new Date().toISOString(),
  }

  fs.mkdirSync(sessionDir(stateDir), { recursive: true })
  fs.mkdirSync(stateDir, { recursive: true })
  fs.writeFileSync(sessionPath(stateDir, metadata.name), `${JSON.stringify(next, null, 2)}\n`)
  fs.writeFileSync(legacySessionPath(stateDir, metadata.name), `${JSON.stringify(next, null, 2)}\n`)

  const registry = loadRegistry(stateDir)
  upsertSession(registry, {
    session_id: next.sessionID || next.sessionId || next.session_id,
    name: next.name,
    agent_id: next.agent_id || next.agentId || next.name,
    runtime_instance_id: next.runtime_instance_id || next.runtimeInstanceId || next.name,
    directory: next.directory,
    agentProfile: next.agentProfile,
    workspace: next.workspace,
    title: next.title,
    host: next.host,
    baseUrl: next.baseUrl,
    transport: next.transport,
    created_at: next.created || null,
    updated_at: next.updated_at,
  })
  saveRegistry(stateDir, registry)

  return next
}

async function promptDeployment(deployment, promptText) {
  const baseUrl = process.env.OPENCODE_URL || await ensureOpencodeServer({
    host: deployment.server.host,
    port: deployment.server.port,
    stateDir: deployment.server.stateDir,
    logDir: deployment.server.logDir,
  })

  const sessionID = execFileSync(deployment.parent.sessionScript, ["--id"], { encoding: "utf8" }).trim()

  await request(baseUrl, "POST", `/session/${sessionID}/prompt_async`, {
    directory: deployment.workspaceRoot,
    body: {
      agent: deployment.parent.agent,
      parts: [{ type: "text", text: promptText }],
    },
  })

  return { baseUrl, sessionID }
}

module.exports = {
  legacySessionPath,
  loadSessionMetadata,
  promptDeployment,
  saveSessionMetadata,
  sessionDir,
  sessionPath,
}
