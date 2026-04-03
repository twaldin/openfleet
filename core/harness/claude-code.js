// core/harness/claude-code.js
// Claude Code harness adapter for openfleet

const { execFileSync } = require("child_process")
const { envelopeSystemMessage } = require('../envelope')

const DEFAULT_MODEL = "opus-4.6"
const DEFAULT_TMUX_SESSION = "openfleet"

function executeClaudeCodeJob({ job, profile, prompt, exec = execFileSync }) {
  const agent = job.agent
  if (!agent) throw new Error("Claude Code execution requires job.agent")

  const envelopedPrompt = envelopeSystemMessage(agent, prompt)
  const tmuxSession = profile.tmux_session || DEFAULT_TMUX_SESSION
  const tmuxWindow = profile.tmux_window || agent

  sendToPane(tmuxSession, tmuxWindow, envelopedPrompt, exec)

  return {
    ok: true,
    mode: "tmux",
    harness: "claude-code",
    host: profile.host || "macbook",
    agent,
    tmux_session: tmuxSession,
    tmux_window: tmuxWindow,
  }
}

function launchClaudeCodeSession(agent, profile, deployment, exec = execFileSync) {
  const tmuxSession = deployment.tmux_session || DEFAULT_TMUX_SESSION
  const tmuxWindow = deployment.tmux_window || agent
  const workdir = deployment.workdir || process.cwd()
  const model = profile.model || DEFAULT_MODEL
  const bootstrapPrompt = deployment.bootstrap_prompt || null

  ensureTmuxSession(tmuxSession, exec)
  recreateWindow(tmuxSession, tmuxWindow, workdir, model, exec)

  if (bootstrapPrompt) {
    sleep(3000)
    sendToPane(tmuxSession, tmuxWindow, bootstrapPrompt, exec)
  }

  return {
    ok: true,
    agent,
    tmux_session: tmuxSession,
    tmux_window: tmuxWindow,
    workdir,
    model,
    launched_at: new Date().toISOString(),
  }
}

function ensureTmuxSession(name, exec = execFileSync) {
  try {
    exec("tmux", ["has-session", "-t", name], { stdio: "ignore" })
  } catch {
    exec("tmux", ["new-session", "-d", "-s", name, "-n", "bootstrap"], { stdio: "ignore" })
  }
}

function recreateWindow(session, window, workdir, model, exec = execFileSync) {
  try {
    exec("tmux", ["kill-window", "-t", `${session}:${window}`], { stdio: "ignore" })
  } catch {
    // window doesn't exist yet, that's fine
  }
  exec("tmux", [
    "new-window",
    "-t", session,
    "-n", window,
    "-c", workdir,
    `claude --dangerously-skip-permissions --model ${model}`,
  ], { stdio: "ignore", shell: true })
}

function sendToPane(session, window, message, exec = execFileSync) {
  exec("tmux", ["send-keys", "-t", `${session}:${window}`, "-l", message], { stdio: "ignore" })
  exec("tmux", ["send-keys", "-t", `${session}:${window}`, "Enter"], { stdio: "ignore" })
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

module.exports = {
  executeClaudeCodeJob,
  launchClaudeCodeSession,
}
