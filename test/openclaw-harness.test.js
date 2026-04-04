const test = require("node:test")
const assert = require("node:assert/strict")

const {
  buildSpawnCommand,
  checkHealth,
  ensureOpenClawBinary,
  sendMessage,
  shutdownOpenClaw,
} = require("../core/harness/openclaw")
const { isAlive } = require("../bin/agent-lifecycle")
const { routeMessage } = require("../bin/send")
const { buildHarnessLaunchCommand, hashAgentPort } = require("../core/remote/ssh")

test("buildSpawnCommand builds an OpenClaw headless launch command with model and port", () => {
  const command = buildSpawnCommand("openclaw-coder", "gpt-5.4", 14567, "/tmp/openfleet")

  assert.match(command, /openclaw/)
  assert.match(command, /--headless/)
  assert.match(command, /--port 14567/)
  assert.match(command, /--model gpt-5\.4/)
})

test("sendMessage posts to the OpenClaw gateway with bearer auth", async () => {
  const calls = []
  const response = { ok: true, status: 202 }

  await sendMessage(14567, "secret-token", "Ship it", async (url, options) => {
    calls.push({ url, options })
    return response
  })

  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, "http://127.0.0.1:14567/api/channels/openfleet/messages")
  assert.equal(calls[0].options.method, "POST")
  assert.equal(calls[0].options.headers.Authorization, "Bearer secret-token")
  assert.equal(calls[0].options.headers["Content-Type"], "application/json")
  assert.equal(calls[0].options.body, JSON.stringify({ message: "Ship it" }))
})

test("checkHealth probes the OpenClaw health endpoint", async () => {
  const calls = []

  const healthy = await checkHealth(14567, async (url, options) => {
    calls.push({ url, options })
    return { ok: true }
  })

  assert.equal(healthy, true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, "http://127.0.0.1:14567/api/health")
  assert.equal(calls[0].options.method, "GET")
})

test("OpenClaw uses the same deterministic port hash as OpenCode", () => {
  const name = "openclaw-coder"
  const expectedPort = 14000 + Math.abs([...name].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 0) % 1000)

  const launch = buildHarnessLaunchCommand({
    harness: "openclaw",
    model: "gpt-5.4",
    workdir: "/tmp/openfleet",
    name,
  })

  assert.equal(hashAgentPort(name), expectedPort)
  assert.equal(launch.openclawPort, expectedPort)
  assert.match(launch.command, new RegExp(`--port ${expectedPort}`))
})

test("shutdownOpenClaw sends the shutdown request with auth", async () => {
  const calls = []

  await shutdownOpenClaw(14567, "secret-token", async (url, options) => {
    calls.push({ url, options })
    return { ok: true }
  })

  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, "http://127.0.0.1:14567/api/shutdown")
  assert.equal(calls[0].options.method, "POST")
  assert.equal(calls[0].options.headers.Authorization, "Bearer secret-token")
})

test("routeMessage uses the OpenClaw session token for openclaw agents", async () => {
  const calls = []

  await routeMessage({
    harness: "openclaw",
    openclaw_port: 14567,
    openclaw_token: "secret-token",
    tmux_session: "openfleet",
    tmux_window: "openclaw-coder",
  }, "Ship it", {
    sendOpenClawImpl(port, token, message) {
      calls.push({ port, token, message })
    },
    hasTmuxWindowImpl() {
      return false
    },
    sendTmuxImpl() {
      throw new Error("tmux should not be used for openclaw")
    },
  })

  assert.deepEqual(calls, [{ port: 14567, token: "secret-token", message: "Ship it" }])
})

test("isAlive checks the OpenClaw health endpoint with curl", () => {
  const calls = []

  const alive = isAlive({
    harness: "openclaw",
    openclaw_port: 14567,
  }, {
    execImpl(file, args) {
      calls.push({ file, args })
      return "ok"
    },
  })

  assert.equal(alive, true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].file, "curl")
  assert.deepEqual(calls[0].args, [
    "--max-time", "2", "-fsS", "http://127.0.0.1:14567/api/health",
  ])
})

test("ensureOpenClawBinary throws a clear error when the binary is missing", () => {
  assert.throws(() => ensureOpenClawBinary({
    execImpl() {
      const error = new Error("spawnSync openclaw ENOENT")
      error.code = "ENOENT"
      throw error
    },
  }), /OpenClaw binary not found\. Install `openclaw` and ensure it is on your PATH\./)
})
