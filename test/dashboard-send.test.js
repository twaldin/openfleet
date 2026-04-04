const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const net = require("node:net")
const { spawn } = require("node:child_process")

function tempStateDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openfleet-dashboard-send-"))
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

async function startDashboard(stateRoot, t, extraEnv = {}) {
  const port = await getAvailablePort()
  const child = spawn(process.execPath, [path.join(__dirname, "..", "bin", "dashboard"), "--port", String(port)], {
    env: {
      ...process.env,
      OPENFLEET_CANONICAL_STATE_DIR: stateRoot,
      OPENFLEET_DASHBOARD_SSE_INTERVAL_MS: "100",
      ...extraEnv,
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

test("dashboard sends messages through bin/send with the web-dashboard sender", async (t) => {
  const stateRoot = tempStateDir()
  const shimDir = fs.mkdtempSync(path.join(os.tmpdir(), "openfleet-node-shim-"))
  const recordFile = path.join(shimDir, "calls.json")
  const shimPath = path.join(shimDir, "node")

  fs.writeFileSync(shimPath, [
    "#!/bin/sh",
    `printf '%s\\n' \"$*\" >> ${JSON.stringify(recordFile)}`,
    "exit 0",
    "",
  ].join("\n"))
  fs.chmodSync(shimPath, 0o755)

  const { baseUrl } = await startDashboard(stateRoot, t, {
    PATH: `${shimDir}:${process.env.PATH}`,
  })
  const token = readToken(stateRoot)

  const response = await fetch(`${baseUrl}/api/agents/coder/send`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: "Check inbox" }),
  })

  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.ok, true)

  const commandLine = fs.readFileSync(recordFile, "utf8")
  assert.match(commandLine, /bin\/send coder --sender web-dashboard --message Check inbox/)
})
