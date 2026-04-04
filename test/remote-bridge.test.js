const test = require("node:test")
const assert = require("node:assert/strict")

const discordAdapter = require("../core/remote/discord-adapter")
const { createAdapter } = require("../core/remote/adapter")

test("discord adapter formats agent.post events", () => {
  const event = {
    type: "agent.post",
    agent_id: "monitor",
    payload: { message: "VPS healthy" },
  }
  assert.equal(discordAdapter.formatEvent(event), "VPS healthy")
})

test("discord adapter formats agent.error events with agent name", () => {
  const event = {
    type: "agent.error",
    agent_id: "trader",
    payload: { error: "Connection timeout" },
  }
  const formatted = discordAdapter.formatEvent(event)
  assert.match(formatted, /Error/)
  assert.match(formatted, /trader/)
  assert.match(formatted, /Connection timeout/)
})

test("discord adapter formats session.spawned events", () => {
  const event = {
    type: "session.spawned",
    agent_id: "coder",
    payload: { harness: "opencode", model: "gpt-5.4" },
  }
  const formatted = discordAdapter.formatEvent(event)
  assert.match(formatted, /coder/)
  assert.match(formatted, /opencode/)
  assert.match(formatted, /gpt-5\.4/)
})

test("discord adapter formats agent.blocked events", () => {
  const event = {
    type: "agent.blocked",
    agent_id: "coder",
    payload: { reason: "need API key" },
  }
  const formatted = discordAdapter.formatEvent(event)
  assert.match(formatted, /Blocked/)
  assert.match(formatted, /need API key/)
})

test("discord adapter formats unknown event types gracefully", () => {
  const event = {
    type: "custom.event",
    agent_id: "test",
    payload: { data: 123 },
  }
  const formatted = discordAdapter.formatEvent(event)
  assert.match(formatted, /custom\.event/)
  assert.match(formatted, /test/)
})

test("discord adapter init and destroy lifecycle", () => {
  discordAdapter.init({ guild: "123" }, "/tmp/test")
  discordAdapter.destroy()
})

test("createAdapter loads discord adapter by name", () => {
  const adapter = createAdapter("discord", { guild: "123" }, "/tmp/test")
  assert.equal(adapter.name, "discord")
  adapter.destroy()
})

test("createAdapter throws for unknown provider", () => {
  assert.throws(() => createAdapter("unknown", {}, "/tmp"), /Unknown remote provider/)
})
