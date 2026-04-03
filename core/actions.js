const { execFileSync } = require("child_process")
const os = require("os")
const path = require("path")
const { executeRemoteAction } = require("./remote")
const { createEventStore } = require("./runtime/events")
const { createJob } = require("./runtime/jobs")
const { createWorkflow } = require("./runtime/workflows")

function defaultStateRoot() {
  return process.env.OPENFLEET_CANONICAL_STATE_DIR || path.join(os.homedir(), ".openfleet")
}

function runAction(action, context = {}) {
  if (!action || !action.type) {
    throw new Error("action.type is required")
  }

  const stateRoot = context.stateRoot || defaultStateRoot()
  const eventStore = createEventStore(stateRoot)
  const exec = context.exec || execFileSync

  switch (action.type) {
    case "parent_message": {
      const script = action.script || process.env.OPENFLEET_MESSAGE_PARENT_SCRIPT || path.resolve(__dirname, '../bin/message_parent')
      const sender = action.sender || context.source || "system"
      const message = interpolate(action.message || "", context)
      exec(script, ["--sender", sender, message], { stdio: "pipe", encoding: "utf8" })
      eventStore.append({
        type: "action.executed",
        agent_id: sender,
        payload: { action: "parent_message", message },
      })
      return { ok: true, type: action.type, message }
    }
    case "discord_post": {
      const message = interpolate(action.message || "", context)
      const result = executeRemoteAction({
        adapter: 'discord',
        action: 'post',
        stateRoot,
        args: {
          message,
          channel: action.channel,
          source: action.source || context.source || 'system',
        },
        deliverers: context.remoteDeliverers,
      })
      eventStore.append({
        type: "action.executed",
        agent_id: action.source || context.source || "system",
        payload: { action: "discord_post", channel: action.channel },
      })
      return result
    }
    case "github_issue_upsert": {
      const script = action.script || process.env.OPENFLEET_MONITOR_ISSUE_SCRIPT || "monitor_issue_upsert"
      const payloadFile = action.payloadFile || context.payloadFile
      if (!payloadFile) throw new Error("github_issue_upsert requires payloadFile")
      const output = exec(script, [payloadFile], { stdio: "pipe", encoding: "utf8" }).trim()
      eventStore.append({
        type: "action.executed",
        agent_id: action.source || context.source || "system",
        payload: { action: "github_issue_upsert", output },
      })
      return { ok: true, type: action.type, output }
    }
    case "git_branch": {
      if (!action.branch) throw new Error("git_branch requires branch")
      if (!action.repo) throw new Error("git_branch requires repo")
      exec('git', ['checkout', '-b', action.branch], { stdio: 'pipe', encoding: 'utf8', cwd: action.repo })
      eventStore.append({
        type: 'action.executed',
        agent_id: action.source || context.source || 'system',
        payload: { action: 'git_branch', branch: action.branch, repo: action.repo },
      })
      return { ok: true, type: action.type, branch: action.branch, repo: action.repo }
    }
    case "git_commit": {
      if (!action.message) throw new Error("git_commit requires message")
      if (!action.repo) throw new Error("git_commit requires repo")
      exec('git', ['commit', '-m', action.message], { stdio: 'pipe', encoding: 'utf8', cwd: action.repo })
      eventStore.append({
        type: 'action.executed',
        agent_id: action.source || context.source || 'system',
        payload: { action: 'git_commit', message: action.message, repo: action.repo },
      })
      return { ok: true, type: action.type, message: action.message, repo: action.repo }
    }
    case "github_pr_create": {
      if (!action.title) throw new Error("github_pr_create requires title")
      if (!action.body) throw new Error("github_pr_create requires body")
      if (!action.repo) throw new Error("github_pr_create requires repo")
      const output = exec('gh', ['pr', 'create', '--title', action.title, '--body', action.body], { stdio: 'pipe', encoding: 'utf8', cwd: action.repo }).trim()
      eventStore.append({
        type: 'action.executed',
        agent_id: action.source || context.source || 'system',
        payload: { action: 'github_pr_create', title: action.title, repo: action.repo, url: output || null },
      })
      return { ok: true, type: action.type, title: action.title, repo: action.repo, url: output || null }
    }
    case "workflow_create": {
      const workflow = createWorkflow(stateRoot, {
        type: action.workflowType || "workflow",
        status: action.status || "created",
        steps: action.steps || [],
        context: action.context || context.context || {},
      })
      eventStore.append({ type: "workflow.created", agent_id: action.source || context.source || "system", payload: workflow })
      return { ok: true, type: action.type, workflow }
    }
    case "job_create": {
      const workflowId = action.workflowId || context.workflowId || null
      const job = createJob(stateRoot, {
        type: action.jobType || "task",
        status: action.status || "queued",
        agent: action.agent || null,
        workflow_id: workflowId,
        trigger: action.trigger || null,
        input: action.input || context.input || null,
      })
      eventStore.append({ type: "job.created", agent_id: action.source || context.source || job.agent || "system", payload: job })
      return { ok: true, type: action.type, job }
    }
    default:
      throw new Error(`Unknown action type: ${action.type}`)
  }
}

function runActions(actions = [], context = {}) {
  return actions.map((action) => runAction(action, context))
}

function interpolate(template, context) {
  return String(template).replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key) => {
    const value = context[key]
    return value == null ? "" : String(value)
  })
}

module.exports = {
  runAction,
  runActions,
}
