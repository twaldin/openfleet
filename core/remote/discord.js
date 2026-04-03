const { execFileSync } = require("child_process")
const path = require("path")
const os = require("os")
const { createEventStore } = require("../runtime/events")

function defaultStateRoot() {
  return process.env.OPENFLEET_CANONICAL_STATE_DIR || path.join(os.homedir(), ".openfleet")
}

function defaultReplyScript() {
  return process.env.OPENFLEET_REPLY_DISCORD_SCRIPT || "/Users/twaldin/claudecord/scripts/reply_discord"
}

function postDiscord({ message, channel, source = "system", stateRoot = defaultStateRoot(), replyScript = defaultReplyScript() }) {
  if (!message || !channel) {
    throw new Error("discord post requires message and channel")
  }

  execFileSync(replyScript, [message, "--channel", channel], { stdio: "pipe", encoding: "utf8" })

  createEventStore(stateRoot).append({
    type: "adapter.delivered",
    agent_id: source,
    severity: "info",
    payload: {
      adapter: "discord",
      channel,
      message,
    },
  })

  return { ok: true, adapter: "discord", channel, source }
}

module.exports = {
  postDiscord,
}
