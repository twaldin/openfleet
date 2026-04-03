const { execFileSync } = require("child_process")
const path = require("path")

function executeCodexJob({ job, profile, prompt }) {
  if (job.agent !== "cairn") {
    throw new Error(`Codex harness execution currently only supports agent=cairn, got ${job.agent}`)
  }
  const output = execFileSync("node", [path.join("/Users/twaldin/openfleet/bin/orchestrator"), "send", "--message", prompt], { encoding: "utf8" }).trim()
  return { ok: true, harness: "codex", host: profile.host || "macbook", output }
}

module.exports = {
  executeCodexJob,
}
