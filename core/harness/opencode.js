const { execFileSync } = require("child_process")
const path = require("path")

function executeOpencodeJob({ job, profile, prompt, stateRoot }) {
  const agent = job.agent
  if (!agent) throw new Error("Opencode execution requires job.agent")

  if (profile.host === "thinkpad-1") {
    if (agent === "monitor") {
      execFileSync(path.join(process.env.HOME, ".cairn", "system", "bin", "thinkpad_monitor_prompt"), [prompt], { encoding: "utf8" })
      return { ok: true, mode: "remote", host: "thinkpad-1", harness: "opencode", agent }
    }
    if (agent === "stock-monitor") {
      execFileSync(path.join(process.env.HOME, ".cairn", "system", "bin", "thinkpad_stock_monitor_prompt"), [prompt], { encoding: "utf8" })
      return { ok: true, mode: "remote", host: "thinkpad-1", harness: "opencode", agent }
    }
    throw new Error(`No remote OpenCode helper for host=${profile.host} agent=${agent}`)
  }

  const localMapping = mapLocalProfile(profile, agent)

  const args = [
    path.join(process.env.HOME, ".cairn", "system", "bin", "message_agent"),
    localMapping.sessionName,
    "--agent",
    localMapping.agentProfile,
    prompt,
  ]
  execFileSync(args[0], args.slice(1), { encoding: "utf8" })
  return { ok: true, mode: "local", host: profile.host || "macbook", harness: "opencode", agent, session: localMapping.sessionName, agentProfile: localMapping.agentProfile }
}

function mapLocalProfile(profile, agent) {
  if (profile.profile_id === 'opencode-gpt54-coder') {
    return { sessionName: 'coder-gpt', agentProfile: 'coder-gpt' }
  }
  if (profile.profile_id === 'opencode-qwen32b-coder') {
    return { sessionName: 'coder', agentProfile: 'coder' }
  }
  if (profile.profile_id === 'opencode-gptmini-evaluator') {
    return { sessionName: 'evaluator', agentProfile: 'evaluator' }
  }
  return { sessionName: agent, agentProfile: agent }
}

module.exports = {
  executeOpencodeJob,
  mapLocalProfile,
}
