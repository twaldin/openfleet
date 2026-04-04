const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

function tempStateDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openfleet-init-"))
}

function createPrompter(answers) {
  const asked = []
  let index = 0

  return {
    asked,
    async ask(message, options = {}) {
      asked.push({ message, defaultValue: options.defaultValue })
      const answer = answers[index++]
      if (answer == null || answer === "") {
        return options.defaultValue || ""
      }
      return answer
    },
  }
}

test("runWizard writes the init state, prints setup details, and skips guild prompt without Discord", async () => {
  const stateRoot = tempStateDir()
  const output = []
  const qrCalls = []
  const prompter = createPrompter(["", ""])
  const { runWizard } = require("../bin/init")

  const result = await runWizard(prompter, {
    stateRoot,
    writeLine: (line = "") => output.push(line),
    tokenGenerator: () => "a".repeat(64),
    dashboardUrl: "http://localhost:3000",
    printQr: (url, details) => {
      qrCalls.push({ url, details })
      return true
    },
    now: () => "2026-04-04T12:00:00.000Z",
  })

  assert.equal(result.authToken, "a".repeat(64))
  assert.equal(fs.existsSync(path.join(stateRoot, "agents")), true)
  assert.equal(fs.existsSync(path.join(stateRoot, "agents", "cairn")), true)

  const remote = JSON.parse(fs.readFileSync(path.join(stateRoot, "remote.json"), "utf8"))
  const agents = JSON.parse(fs.readFileSync(path.join(stateRoot, "agents.json"), "utf8"))
  const cron = JSON.parse(fs.readFileSync(path.join(stateRoot, "cron.json"), "utf8"))
  const orchestrator = JSON.parse(fs.readFileSync(path.join(stateRoot, "orchestrator.json"), "utf8"))

  assert.equal(remote.auth.token, "a".repeat(64))
  assert.equal(remote.defaults.model, "claude")
  assert.equal(remote.defaults.harness, "claude-code")
  assert.equal(remote.provider, null)
  assert.deepEqual(agents, { agents: {} })
  assert.equal(cron.jobs[0].id, "heartbeat")
  assert.equal(orchestrator.harness, "claude-code")
  assert.equal(orchestrator.model, "claude")
  assert.equal(orchestrator.tmux_window, "cairn")

  assert.equal(fs.existsSync(path.join(stateRoot, "discord.json")), false)
  assert.equal(prompter.asked.some((item) => item.message.includes("Discord guild ID")), false)
  assert.match(output.join("\n"), /Welcome to OpenFleet/i)
  assert.match(output.join("\n"), /Setup complete! Run openfleet start to boot the fleet\./)
  assert.match(output.join("\n"), /Dashboard URL: http:\/\/localhost:3000/)
  assert.match(output.join("\n"), /Dashboard auth token: a{64}/)
  assert.equal(qrCalls.length, 1)
  assert.equal(qrCalls[0].url, "http://localhost:3000")
  assert.equal(qrCalls[0].details.authToken, "a".repeat(64))
})

test("runWizard stores Discord config in remote.json and discord.json when token is provided", async () => {
  const stateRoot = tempStateDir()
  const prompter = createPrompter(["discord-token", "guild-123", "gpt", "openclaw"])
  const { runWizard } = require("../bin/init")

  await runWizard(prompter, {
    stateRoot,
    writeLine: () => {},
    tokenGenerator: () => "b".repeat(64),
    printQr: () => false,
    now: () => "2026-04-04T12:00:00.000Z",
  })

  const remote = JSON.parse(fs.readFileSync(path.join(stateRoot, "remote.json"), "utf8"))
  const discord = JSON.parse(fs.readFileSync(path.join(stateRoot, "discord.json"), "utf8"))
  const orchestrator = JSON.parse(fs.readFileSync(path.join(stateRoot, "orchestrator.json"), "utf8"))

  assert.equal(remote.provider, "discord")
  assert.equal(remote.discord.token, "discord-token")
  assert.equal(remote.discord.guild, "guild-123")
  assert.equal(remote.auth.token, "b".repeat(64))
  assert.equal(remote.defaults.model, "gpt")
  assert.equal(remote.defaults.harness, "openclaw")

  assert.equal(discord.token, "discord-token")
  assert.equal(discord.guild_id, "guild-123")
  assert.deepEqual(discord.channels, {})

  assert.equal(orchestrator.harness, "openclaw")
  assert.equal(orchestrator.model, "gpt")
  assert.equal(prompter.asked.filter((item) => item.message.includes("Discord guild ID")).length, 1)
})

test("openfleet CLI exposes the init command in its command table and help text", () => {
  const { commands, renderHelp } = require("../bin/openfleet")

  assert.equal(typeof commands.init, "function")
  assert.match(renderHelp(), /init\s+Interactive setup wizard/)
})
