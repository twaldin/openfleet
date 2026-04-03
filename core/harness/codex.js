const { execFileSync } = require("child_process")
const path = require("path")
const { envelopeSystemMessage } = require('../envelope')

function executeCodexJob({ job, profile, prompt, exec = execFileSync }) {
  const envelopedPrompt = envelopeSystemMessage(job.agent, prompt)
  const output = exec("node", [path.resolve(__dirname, '../../bin/orchestrator'), "send", "--message", envelopedPrompt], { encoding: "utf8" }).trim()
  return { ok: true, harness: "codex", host: profile.host || "macbook", output }
}

module.exports = {
  executeCodexJob,
}
