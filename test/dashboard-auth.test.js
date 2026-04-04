const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const net = require("node:net")
const { execFileSync, spawn } = require("node:child_process")

function tempStateDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openfleet-dashboard-auth-"))
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

  let stderr = ""
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString()
  })

  t.after(async () => {
    if (child.exitCode === null) {
      child.kill("SIGTERM")
      await new Promise((resolve) => child.once("exit", resolve))
    }
  })

  await waitForServer(`http://127.0.0.1:${port}/`)
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    getStderr: () => stderr,
  }
}

function readToken(stateRoot) {
  const config = JSON.parse(fs.readFileSync(path.join(stateRoot, "remote.json"), "utf8"))
  return config.auth.token
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` }
}

async function waitForStreamClose(reader, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const remaining = deadline - Date.now()
    const result = await Promise.race([
      reader.read(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timed out waiting for SSE close")), remaining)),
    ])

    if (result.done) return
  }

  throw new Error("Timed out waiting for SSE close")
}

test("dashboard start generates a persistent auth token", async (t) => {
  const stateRoot = tempStateDir()
  await startDashboard(stateRoot, t)

  const token = readToken(stateRoot)
  assert.match(token, /^[a-f0-9]{64}$/)
})

test("dashboard API rejects requests without a bearer token and accepts valid tokens", async (t) => {
  const stateRoot = tempStateDir()
  const { baseUrl } = await startDashboard(stateRoot, t)
  const token = readToken(stateRoot)
  const wrongToken = token.slice(0, -1) + (token.endsWith("0") ? "1" : "0")

  const unauthorized = await fetch(`${baseUrl}/api/status`)
  assert.equal(unauthorized.status, 401)

  const wrongTokenResponse = await fetch(`${baseUrl}/api/status`, { headers: authHeaders(wrongToken) })
  assert.equal(wrongTokenResponse.status, 401)

  const authorized = await fetch(`${baseUrl}/api/status`, { headers: authHeaders(token) })
  assert.equal(authorized.status, 200)
})

test("dashboard SSE accepts token query param and rejects missing token", async (t) => {
  const stateRoot = tempStateDir()
  const { baseUrl } = await startDashboard(stateRoot, t)
  const token = readToken(stateRoot)

  const unauthorized = await fetch(`${baseUrl}/api/stream`)
  assert.equal(unauthorized.status, 401)

  const authorized = await fetch(`${baseUrl}/api/stream?token=${token}`)
  assert.equal(authorized.status, 200)
  assert.match(authorized.headers.get("content-type") || "", /text\/event-stream/)
  await authorized.body.cancel()
})

test("rotating the auth token invalidates the old dashboard token", async (t) => {
  const stateRoot = tempStateDir()
  const { baseUrl } = await startDashboard(stateRoot, t)
  const oldToken = readToken(stateRoot)

  const sseResponse = await fetch(`${baseUrl}/api/stream?token=${oldToken}`)
  assert.equal(sseResponse.status, 200)
  const reader = sseResponse.body.getReader()
  await reader.read()

  execFileSync("node", [path.join(__dirname, "..", "bin", "auth"), "rotate", "--state-root", stateRoot], {
    encoding: "utf8",
  })

  const newToken = readToken(stateRoot)
  assert.notEqual(newToken, oldToken)

  const oldResponse = await fetch(`${baseUrl}/api/status`, { headers: authHeaders(oldToken) })
  assert.equal(oldResponse.status, 401)

  const oldSseResponse = await fetch(`${baseUrl}/api/stream?token=${oldToken}`)
  assert.equal(oldSseResponse.status, 401)

  await waitForStreamClose(reader)

  const newResponse = await fetch(`${baseUrl}/api/status`, { headers: authHeaders(newToken) })
  assert.equal(newResponse.status, 200)
})
