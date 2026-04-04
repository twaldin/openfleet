const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

const { loadRemoteConfig, resolveEventRouting, resolveCaptureConfig } = require("../core/remote/config")

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openfleet-remote-config-"))
}

test("loadRemoteConfig returns null when no config file exists", () => {
  const dir = tempDir()
  assert.equal(loadRemoteConfig(dir), null)
})

test("loadRemoteConfig parses valid config", () => {
  const dir = tempDir()
  fs.writeFileSync(path.join(dir, "remote.json"), JSON.stringify({
    provider: "discord",
    discord: { guild: "123" },
  }))
  const config = loadRemoteConfig(dir)
  assert.equal(config.provider, "discord")
  assert.equal(config.discord.guild, "123")
})

test("resolveEventRouting uses config overrides", () => {
  const config = {
    event_routing: {
      "agent.post": { post: true, channel: "general" },
      "agent.compacted": { post: true, channel: "logs" },
    },
  }
  assert.deepEqual(resolveEventRouting(config, "agent.post"), { post: true, channel: "general" })
  assert.deepEqual(resolveEventRouting(config, "agent.compacted"), { post: true, channel: "logs" })
})

test("resolveEventRouting falls back to defaults for unknown config", () => {
  const routing = resolveEventRouting({}, "agent.error")
  assert.equal(routing.post, true)
  assert.equal(routing.channel, "alerts")
})

test("resolveEventRouting returns post:false for unrecognized event types", () => {
  const routing = resolveEventRouting({}, "some.random.event")
  assert.equal(routing.post, false)
})

test("resolveCaptureConfig respects enabled flag", () => {
  assert.equal(resolveCaptureConfig({ capture: { enabled: false } }, "monitor").enabled, false)
  assert.equal(resolveCaptureConfig({ capture: { enabled: true } }, "monitor").enabled, true)
})

test("resolveCaptureConfig uses agent-specific interval override", () => {
  const config = {
    capture: {
      enabled: true,
      default_interval_seconds: 30,
      agents: {
        monitor: { interval: 120 },
        trader: { interval: 240 },
      },
    },
  }
  assert.equal(resolveCaptureConfig(config, "monitor").interval, 120)
  assert.equal(resolveCaptureConfig(config, "trader").interval, 240)
  assert.equal(resolveCaptureConfig(config, "coder").interval, 30)
})

test("resolveCaptureConfig disables specific agents", () => {
  const config = {
    capture: {
      enabled: true,
      agents: { "coder-gpt": { enabled: false } },
    },
  }
  assert.equal(resolveCaptureConfig(config, "coder-gpt").enabled, false)
  assert.equal(resolveCaptureConfig(config, "monitor").enabled, true)
})
