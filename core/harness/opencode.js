const { execFileSync } = require("child_process")
const os = require("os")
const path = require("path")
const { envelopeSystemMessage } = require('../envelope')

function resolveHelperDir() {
  return process.env.OPENFLEET_HELPER_DIR || path.join(os.homedir(), ".openfleet", "bin")
}

function executeOpencodeJob({ job, profile, prompt, stateRoot, exec = execFileSync }) {
  const agent = job.agent
  if (!agent) throw new Error("Opencode execution requires job.agent")
  const envelopedPrompt = envelopeSystemMessage(agent, prompt)
  const helperDir = resolveHelperDir()
  const localHost = process.env.OPENFLEET_LOCAL_HOST || os.hostname()

  if (profile.host && profile.host !== localHost && profile.host !== "macbook") {
    const dispatchScript = profile.dispatch_script
      || path.join(helperDir, `${profile.host.replace(/-/g, '_')}_${agent.replace(/-/g, '_')}_prompt`)
    exec(dispatchScript, [envelopedPrompt], { encoding: "utf8" })
    return { ok: true, mode: "remote", host: profile.host, harness: "opencode", agent }
  }

  const localMapping = mapLocalProfile(profile, agent)

  const args = [
    path.join(helperDir, "message_agent"),
    localMapping.sessionName,
    "--agent",
    localMapping.agentProfile,
    envelopedPrompt,
  ]
  exec(args[0], args.slice(1), { encoding: "utf8" })
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
