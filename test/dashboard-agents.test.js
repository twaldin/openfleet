const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const net = require("node:net")
const { spawn } = require("node:child_process")

function tempStateDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openfleet-dashboard-agents-"))
}

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, () => {
      const address = server.address()
      server.close(() => resolve(address.port))
    })
    server.on("error", reject)
  })
}

async function waitForServer(baseUrl) {
  const deadline = Date.now() + 5000
  let lastError = null
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl)
      await response.text()
      return
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
  throw lastError || new Error(`Timed out waiting for ${baseUrl}`)
}

async function startDashboard(stateRoot, t) {
  const port = await getAvailablePort()
  const child = spawn("node", [path.join(__dirname, "..", "bin", "dashboard"), "--port", String(port)], {
    env: {
      ...process.env,
      OPENFLEET_CANONICAL_STATE_DIR: stateRoot,
      OPENFLEET_DASHBOARD_SSE_INTERVAL_MS: "100",
    },
    stdio: ["ignore", "pipe", "pipe"],
  })

  t.after(async () => {
    if (child.exitCode === null) {
      child.kill("SIGTERM")
      await new Promise((resolve) => child.once("exit", resolve))
    }
  })

  await waitForServer(`http://127.0.0.1:${port}/`)
  return { baseUrl: `http://127.0.0.1:${port}` }
}

function readToken(stateRoot) {
  const config = JSON.parse(fs.readFileSync(path.join(stateRoot, "remote.json"), "utf8"))
  return config.auth.token
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function isoMinutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString()
}

test("dashboard status includes alive and dead agent state", async (t) => {
  const stateRoot = tempStateDir()
  writeJson(path.join(stateRoot, "agents.json"), {
    agents: {
      "coder-live": { name: "coder-live", role: "ephemeral", harness: "opencode", model: "gpt-5.4" },
      "coder-dead": { name: "coder-dead", role: "ephemeral", harness: "codex", model: "gpt-5.4-mini" },
    },
  })
  writeJson(path.join(stateRoot, "registry.json"), {
    sessions: {
      live: {
        session_id: "live",
        name: "coder-live",
        role: "ephemeral",
        harness: "opencode",
        model: "gpt-5.4",
        updated_at: isoMinutesAgo(2),
      },
      dead: {
        session_id: "dead",
        name: "coder-dead",
        role: "ephemeral",
        harness: "codex",
        model: "gpt-5.4-mini",
        updated_at: isoMinutesAgo(20),
      },
    },
  })

  const { baseUrl } = await startDashboard(stateRoot, t)
  const token = readToken(stateRoot)
  const response = await fetch(`${baseUrl}/api/status`, { headers: authHeaders(token) })
  const data = await response.json()

  const liveAgent = data.agents.find((agent) => agent.name === "coder-live")
  const deadAgent = data.agents.find((agent) => agent.name === "coder-dead")

  assert.equal(liveAgent.alive, true)
  assert.equal(liveAgent.status, "alive")
  assert.equal(deadAgent.alive, false)
  assert.equal(deadAgent.status, "dead")
})

test("dashboard status sorts alive agents before dead agents", async (t) => {
  const stateRoot = tempStateDir()
  writeJson(path.join(stateRoot, "agents.json"), {
    agents: {
      "aaa-dead": { name: "aaa-dead", role: "ephemeral", harness: "codex" },
      "zzz-live": { name: "zzz-live", role: "ephemeral", harness: "opencode" },
    },
  })
  writeJson(path.join(stateRoot, "registry.json"), {
    sessions: {
      live: {
        session_id: "live",
        name: "zzz-live",
        role: "ephemeral",
        updated_at: isoMinutesAgo(2),
      },
      dead: {
        session_id: "dead",
        name: "aaa-dead",
        role: "ephemeral",
        updated_at: isoMinutesAgo(20),
      },
    },
  })

  const { baseUrl } = await startDashboard(stateRoot, t)
  const token = readToken(stateRoot)
  const response = await fetch(`${baseUrl}/api/status`, { headers: authHeaders(token) })
  const data = await response.json()

  assert.deepEqual(data.agents.map((agent) => agent.name), ["zzz-live", "aaa-dead"])
})

test("dashboard status includes the orchestrator as cairn", async (t) => {
  const stateRoot = tempStateDir()
  writeJson(path.join(stateRoot, "orchestrator.json"), {
    profile_id: "main",
    harness: "claude-code",
    model: "opus-4.6",
    tmux_session: "openfleet",
    tmux_window: "cairn",
    workdir: "~/openfleet",
    activated_at: isoMinutesAgo(1),
  })

  const { baseUrl } = await startDashboard(stateRoot, t)
  const token = readToken(stateRoot)
  const response = await fetch(`${baseUrl}/api/status`, { headers: authHeaders(token) })
  const data = await response.json()

  assert.equal(data.agents[0]?.name, "cairn")
  assert.equal(data.agents[0]?.role, "orchestrator")
})
