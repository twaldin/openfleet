const fs = require("fs")
const os = require("os")
const path = require("path")
const { ensureOpencodeServer, request } = require("../lib/opencode")
const { loadRegistry } = require("./runtime/registry")
const { loadSessionMetadata, sessionDir } = require("./runtime/session")
const { readEvents } = require("./runtime/events")
const { listJobs } = require("./runtime/jobs")
const { listWorkflows } = require("./runtime/workflows")
const { listTasks } = require("./runtime/tasks")
const { listBlockers } = require("./runtime/blockers")
const { listApprovals } = require("./runtime/approvals")

function defaultStateRoot() {
  return process.env.OPENFLEET_CANONICAL_STATE_DIR || path.join(os.homedir(), ".openfleet")
}

function listAgentMetadata(stateRoot = defaultStateRoot()) {
  const registry = loadRegistry(stateRoot)
  const dir = sessionDir(stateRoot)
  const items = []
  const seen = new Set()

  try {
    for (const entry of fs.readdirSync(dir)) {
      if (!entry.endsWith(".json")) continue
      const name = entry.slice(0, -5)
      const meta = loadSessionMetadata(stateRoot, name)
      if (!meta) continue
      items.push(enrich(meta, registry))
      seen.add(name)
    }
  } catch {
    // ignore missing dir
  }

  for (const session of Object.values(registry.sessions || {})) {
    if (!session.name || seen.has(session.name)) continue
    items.push(enrich({ name: session.name, ...session }, registry))
  }

  return items.sort((a, b) => a.name.localeCompare(b.name))
}

function enrich(meta, registry) {
  const sessionId = meta.sessionID || meta.sessionId || meta.session_id || null
  const reg = sessionId ? registry.sessions?.[sessionId] : null
  const agentId = meta.agent_id || meta.agentId || reg?.agent_id || reg?.agentId || meta.name
  const runtimeInstanceId = meta.runtime_instance_id || meta.runtimeInstanceId || reg?.runtime_instance_id || reg?.runtimeInstanceId || meta.name
  const host = meta.host || reg?.host || null
  const baseUrl = meta.baseUrl || reg?.baseUrl || null
  const transport = meta.transport || reg?.transport || null
  const location = baseUrl ? "remote" : "local"
  return {
    name: meta.name,
    agent_id: agentId,
    runtime_instance_id: runtimeInstanceId,
    sessionID: sessionId,
    title: meta.title || reg?.title || null,
    directory: meta.directory || reg?.directory || null,
    workspace: meta.workspace || reg?.workspace || null,
    agentProfile: meta.agentProfile || reg?.agentProfile || null,
    created: meta.created || reg?.created_at || null,
    updated: meta.updated_at || meta.updated || reg?.updated_at || null,
    host,
    baseUrl,
    transport,
    location,
    visibility: host ? `${location}@${host}` : location,
    seq: reg?.seq || null,
    lastEventID: reg?.last_event_id || null,
  }
}

function inspectAgent(stateRoot, name, limit = 20) {
  const registry = loadRegistry(stateRoot)
  const meta = loadSessionMetadata(stateRoot, name)
  if (!meta) {
    throw new Error(`Unknown agent metadata: ${name}`)
  }

  const sessionId = meta.sessionID || meta.sessionId || meta.session_id
  const events = sessionId ? readEvents(stateRoot, { sessionId, limit }) : []

  return {
    metadata: enrich(meta, registry),
    events,
  }
}

async function fetchSessionMessages({ metadata, host = "127.0.0.1", port = "4096", serverStateDir, serverLogDir }) {
  const baseUrl = metadata.baseUrl || process.env.OPENCODE_URL || await ensureOpencodeServer({
    host,
    port,
    stateDir: serverStateDir,
    logDir: serverLogDir,
  })

  const sessionId = metadata.sessionID || metadata.sessionId || metadata.session_id
  const directory = metadata.directory || metadata.workspace
  if (!sessionId || !directory) {
    throw new Error(`Missing session metadata for ${metadata.name}`)
  }

  return request(baseUrl, "GET", `/session/${sessionId}/message`, { directory })
}

function renderMessages(messages, limit = 20) {
  return messages.slice(-limit).map((message) => {
    const info = message.info || {}
    const textParts = (message.parts || [])
      .filter((part) => part.type === "text" && part.text)
      .map((part) => part.text.trim())
      .filter(Boolean)

    return {
      role: info.role || null,
      provider: info.providerID || null,
      model: info.modelID || null,
      finish: info.finish || null,
      text: textParts.join("\n\n") || null,
      partTypes: (message.parts || []).map((part) => part.type),
    }
  })
}

function buildCaptureSurface({ metadata, messages }) {
  return renderTranscriptSurface(metadata, messages)
}

function buildFollowSurface({ metadata, messages, lastCount = 0 }) {
  return renderTranscriptSurface(metadata, messages.slice(lastCount))
}

module.exports = {
  buildApprovalSurface,
  buildCaptureSurface,
  buildDashboard,
  buildDashboardSurface,
  buildBlockerSurface,
  buildFollowSurface,
  buildPresenceSurface,
  buildSummary,
  defaultStateRoot,
  fetchSessionMessages,
  inspectAgent,
  listAgentMetadata,
  renderListSurface,
  renderMessages,
}

function buildDashboard(stateRoot = defaultStateRoot()) {
  const agents = listAgentMetadata(stateRoot)
  const jobs = listJobs(stateRoot)
  const workflows = listWorkflows(stateRoot)
  const tasks = listTasks(stateRoot)
  const blockers = listBlockers(stateRoot)
  const approvals = listApprovals(stateRoot)

  const enrichedAgents = agents.map((agent) => classifyAgent(agent, jobs))

  const taskItems = tasks.map((task) => enrichTask(task, workflows, jobs, enrichedAgents))
  const scheduledJobs = jobs.filter((job) => Boolean(job.trigger) && job.trigger !== 'workflow-complete')
  const maintenanceLoops = scheduledJobs.filter((job) => isMaintenanceLoop(job))

  return {
    generated_at: new Date().toISOString(),
    counts: {
      agents: enrichedAgents.length,
      jobs: jobs.length,
      workflows: workflows.length,
      tasks: tasks.length,
      blockers: blockers.length,
      approvals: approvals.length,
    },
    agents: enrichedAgents,
    task_items: taskItems,
    jobs: summarizeByStatus(jobs),
    workflows: summarizeByStatus(workflows),
    tasks: summarizeByStatus(tasks),
    open_blockers: blockers.filter((item) => item.status === "open"),
    pending_approvals: approvals.filter((item) => item.status === "pending"),
    active_workflows: workflows.filter((item) => item.status === "active"),
    runnable_jobs: jobs.filter((item) => ["queued", "assigned"].includes(item.status)),
    in_progress_jobs: jobs.filter((item) => ["running", "dispatched"].includes(item.status)),
    scheduled_jobs: scheduledJobs,
    maintenance_loops: maintenanceLoops,
  }
}

function enrichTask(task, workflows, jobs, agents = []) {
  const workflow = task.workflow_id ? workflows.find((wf) => wf.id === task.workflow_id) : null
  const relatedJobs = workflow ? jobs.filter((job) => job.workflow_id === workflow.id) : []
  const activeJob = relatedJobs.find((job) => ['running', 'dispatched', 'assigned', 'queued', 'blocked'].includes(job.status)) || null
  const logicalOwner = task.assignee || activeJob?.agent || null
  const activeWorker = activeJob?.agent || logicalOwner || null
  const workerAgent = activeWorker
    ? agents.find((agent) => agent.agent_id === activeWorker || agent.name === activeWorker)
    : null
  return {
    ...task,
    logical_owner: logicalOwner,
    current_step: workflow?.current_step || null,
    workflow_status: workflow?.status || null,
    active_job_id: activeJob?.id || null,
    active_agent: activeWorker,
    active_runtime_instance: workerAgent?.runtime_instance_id || null,
    active_runtime_status: workerAgent?.runtime_state || null,
    active_profile: activeJob?.input?.selected_profile || activeJob?.output?.selected_profile || null,
  }
}

function summarizeByStatus(items) {
  const summary = {}
  for (const item of items) {
    const status = item.status || "unknown"
    summary[status] = (summary[status] || 0) + 1
  }
  return summary
}

function buildSummary(stateRoot = defaultStateRoot(), options = {}) {
  const dashboard = buildDashboard(stateRoot)
  const scoped = scopeDashboard(dashboard, options)
  const lines = []
  lines.push(`OpenFleet summary @ ${dashboard.generated_at}`)
  if (options.agent || options.channelBinding) {
    lines.push(`Scope: agent=${options.agent || 'any'}, channel=${options.channelBinding || 'any'}`)
  }
  lines.push(`Agents: ${dashboard.counts.agents} | Jobs: ${dashboard.counts.jobs} | Workflows: ${dashboard.counts.workflows} | Tasks: ${scoped.tasks.length}`)
  lines.push(`Open blockers: ${scoped.open_blockers.length} | Pending approvals: ${scoped.pending_approvals.length}`)

  const activeAgents = dashboard.agents.map((a) => `${a.name}(${a.runtime_state}${a.host ? `/${a.host}` : ''})`).join(', ')
  lines.push(`Agents: ${activeAgents}`)

  if (dashboard.runnable_jobs.length) {
    lines.push('Runnable jobs:')
    for (const job of dashboard.runnable_jobs.slice(0, 5)) {
      lines.push(`- ${job.type} -> ${job.agent} (${job.id})`)
    }
  }

  if (dashboard.in_progress_jobs.length) {
    lines.push('In-progress jobs:')
    for (const job of dashboard.in_progress_jobs.slice(0, 5)) {
      lines.push(`- ${job.type} -> ${job.agent} [${job.status}] (${job.id})`)
    }
  }

  if (dashboard.scheduled_jobs.length) {
    lines.push('Scheduled jobs:')
    for (const job of dashboard.scheduled_jobs.slice(0, 5)) {
      lines.push(`- ${job.type} -> ${job.agent || 'unassigned'} [${job.trigger}]`)
    }
  }

  if (dashboard.maintenance_loops.length) {
    lines.push('Maintenance loops:')
    for (const job of dashboard.maintenance_loops.slice(0, 5)) {
      lines.push(`- ${job.type} -> ${job.agent || 'unassigned'} [${job.trigger}]`)
    }
  }

  if (scoped.tasks.length) {
    lines.push('Open tasks:')
    for (const task of scoped.tasks.slice(0, 5)) {
      const owner = task.logical_owner || '-'
      const worker = task.active_agent || '-'
      const step = task.current_step || task.workflow_status || task.status || 'unknown'
      lines.push(`- ${task.title} | owner=${owner} | worker=${worker} | instance=${task.active_runtime_instance || '-'} | step=${step} @ ${task.channel_binding || 'no-channel'}`)
    }
  }

  if (scoped.open_blockers.length) {
    lines.push('Open blockers:')
    for (const blocker of scoped.open_blockers.slice(0, 5)) {
      lines.push(`- ${blocker.agent_id}: ${blocker.summary} @ ${blocker.channel_binding || 'no-channel'}`)
    }
  }

  if (scoped.pending_approvals.length) {
    lines.push('Pending approvals:')
    for (const approval of scoped.pending_approvals.slice(0, 5)) {
      lines.push(`- ${approval.agent_id}: ${approval.summary} @ ${approval.channel_binding || 'no-channel'}`)
    }
  }

  return lines.join('\n')
}

function buildDashboardSurface(stateRoot = defaultStateRoot()) {
  const dashboard = buildDashboard(stateRoot)
  const lines = []
  lines.push(`OpenFleet dashboard @ ${dashboard.generated_at}`)
  lines.push(`Counts: agents=${dashboard.counts.agents} jobs=${dashboard.counts.jobs} workflows=${dashboard.counts.workflows} tasks=${dashboard.counts.tasks} blockers=${dashboard.counts.blockers} approvals=${dashboard.counts.approvals}`)
  lines.push('')
  lines.push('Agent presence:')
  if (dashboard.agents.length) {
    for (const agent of dashboard.agents.slice(0, 8)) {
      lines.push(`- ${agent.agent_id || agent.name} | instance=${agent.runtime_instance_id || agent.name} | ${formatRuntimeState(agent.runtime_state)} | host=${agent.host || 'unknown'} | profile=${agent.agentProfile || 'unknown'}`)
    }
  } else {
    lines.push('- none')
  }

  if (dashboard.task_items.length) {
    lines.push('')
    lines.push('Tasks:')
    for (const task of dashboard.task_items.slice(0, 5)) {
      const step = task.current_step || task.workflow_status || task.status || 'unknown'
      lines.push(`- ${task.title} | owner=${task.logical_owner || '-'} | worker=${task.active_agent || '-'} | instance=${task.active_runtime_instance || '-'} | step=${step}`)
    }
  }

  if (dashboard.in_progress_jobs.length) {
    lines.push('')
    lines.push('In-progress jobs:')
    for (const job of dashboard.in_progress_jobs.slice(0, 5)) {
      lines.push(`- ${job.type} -> ${job.agent || 'unassigned'} [${job.status}] (${job.id})`)
    }
  }

  if (dashboard.runnable_jobs.length) {
    lines.push('')
    lines.push('Runnable jobs:')
    for (const job of dashboard.runnable_jobs.slice(0, 5)) {
      lines.push(`- ${job.type} -> ${job.agent || 'unassigned'} [${job.status}] (${job.id})`)
    }
  }

  if (dashboard.scheduled_jobs.length) {
    lines.push('')
    lines.push('Scheduled jobs:')
    for (const job of dashboard.scheduled_jobs.slice(0, 5)) {
      lines.push(`- ${job.type} -> ${job.agent || 'unassigned'} [${job.trigger}]`)
    }
  }

  if (dashboard.maintenance_loops.length) {
    lines.push('')
    lines.push(`Maintenance loops: ${dashboard.maintenance_loops.length}`)
  }

  if (dashboard.open_blockers.length || dashboard.pending_approvals.length) {
    lines.push('')
    lines.push(`Flow control: blockers=${dashboard.open_blockers.length} approvals=${dashboard.pending_approvals.length}`)
  }

  return lines.join('\n')
}

function buildApprovalSurface(stateRoot = defaultStateRoot(), options = {}) {
  const scoped = scopeDashboard(buildDashboard(stateRoot), options)
  const label = describeScope(options)
  if (!scoped.pending_approvals.length) {
    return `No pending approvals${label}`
  }

  return [
    `Pending approvals${label}`,
    ...scoped.pending_approvals.slice(0, 10).map((approval) => (
      `- ${approval.summary} | agent=${approval.agent_id || 'unknown'} | action=${approval.action_type || 'approval'} | risk=${approval.risk_class || 'unknown'}`
    )),
  ].join('\n')
}

function buildBlockerSurface(stateRoot = defaultStateRoot(), options = {}) {
  const scoped = scopeDashboard(buildDashboard(stateRoot), options)
  const label = describeScope(options)
  if (!scoped.open_blockers.length) {
    return `No open blockers${label}`
  }

  return [
    `Open blockers${label}`,
    ...scoped.open_blockers.slice(0, 10).map((blocker) => (
      `- ${blocker.summary} | agent=${blocker.agent_id || 'unknown'} | question=${blocker.question || 'none'} | urgency=${blocker.urgency || 'normal'}`
    )),
  ].join('\n')
}

function buildPresenceSurface(stateRoot = defaultStateRoot(), options = {}) {
  const dashboard = buildDashboard(stateRoot)
  const label = describeScope(options)
  const agents = (dashboard.agents || []).filter((agent) => !options.agent || agent.name === options.agent)
  if (!agents.length) {
    return `No agent presence${label}`
  }

  return [
    `Agent presence @ ${dashboard.generated_at}${label}`,
    ...agents.slice(0, 20).map((agent) => (
      `${agent.agent_id || agent.name} | instance=${agent.runtime_instance_id || agent.name} | ${formatRuntimeState(agent.runtime_state)} | host=${agent.host || 'unknown'} | profile=${agent.agentProfile || 'unknown'}${agent.updated_age_minutes != null ? ` | age=${agent.updated_age_minutes}m` : ''}${agent.active_job_type ? ` | job=${agent.active_job_type}` : ''}`
    )),
  ].join('\n')
}

function renderTranscriptSurface(metadata, messages) {
  const lines = []
  lines.push(`agent=${metadata.agent_id || metadata.name} instance=${metadata.runtime_instance_id || metadata.name} session=${metadata.sessionID || '-'} model=${metadata.agentProfile || '-'} location=${metadata.location || '-'} host=${metadata.host || '-'} baseUrl=${metadata.baseUrl || '-'}`)
  if (!messages.length) {
    lines.push('')
    lines.push('No new messages.')
    return lines.join('\n')
  }
  for (const msg of messages) {
    lines.push('')
    lines.push(`[${msg.role || 'unknown'}] provider=${msg.provider || '-'} model=${msg.model || '-'} finish=${msg.finish || '-'}`)
    lines.push(msg.text ? msg.text : `parts=${(msg.partTypes || []).join(',')}`)
  }
  return lines.join('\n')
}

function renderListSurface(items) {
  if (!Array.isArray(items) || !items.length) {
    return 'No records.'
  }

  if (items[0].name || items[0].sessionID) {
    const lines = ['AGENT\tINSTANCE\tPROFILE\tLOCATION\tHOST\tSESSION\tUPDATED']
    for (const item of items) {
      lines.push(`${item.agent_id || item.name}\t${item.runtime_instance_id || item.name}\t${item.agentProfile || '-'}\t${item.location || '-'}\t${item.host || '-'}\t${item.sessionID || '-'}\t${item.updated || '-'}`)
    }
    return lines.join('\n')
  }

  if (items[0].id && items[0].type && Object.prototype.hasOwnProperty.call(items[0], 'current_step')) {
    const lines = ['ID\tTYPE\tSTATUS\tSTEP\tUPDATED']
    for (const item of items) {
      lines.push(`${item.id}\t${item.type}\t${item.status || '-'}\t${item.current_step || '-'}\t${item.updated_at || '-'}`)
    }
    return lines.join('\n')
  }

  if (items[0].id && items[0].type) {
    const lines = ['ID\tTYPE\tSTATUS\tAGENT\tWORKFLOW\tUPDATED']
    for (const item of items) {
      lines.push(`${item.id}\t${item.type}\t${item.status || '-'}\t${item.agent || '-'}\t${item.workflow_id || '-'}\t${item.updated_at || '-'}`)
    }
    return lines.join('\n')
  }

  return items.map((item) => JSON.stringify(item)).join('\n')
}

function formatRuntimeState(state) {
  switch (state) {
    case 'alive-working':
      return 'working (active)'
    case 'alive-runnable':
      return 'queued (runnable)'
    case 'alive-idle':
      return 'idle (healthy)'
    case 'stale':
      return 'stale (needs check)'
    case 'dead':
      return 'dead (offline)'
    default:
      return state || 'unknown'
  }
}

function isMaintenanceLoop(job) {
  const trigger = String(job.trigger || '').toLowerCase()
  const type = String(job.type || '').toLowerCase()
  return /maintenance|schedule|scheduler|cron/.test(trigger) || type.startsWith('monitor.') || type.startsWith('stock-monitor.')
}

function scopeDashboard(dashboard, options = {}) {
  const agent = options.agent || null
  const channelBinding = options.channelBinding || null
  const matches = (item, agentField, channelField = 'channel_binding') => {
    if (agent && item?.[agentField] !== agent) return false
    if (channelBinding && item?.[channelField] !== channelBinding) return false
    return true
  }

  return {
    tasks: listOpenTasks(dashboard).filter((item) => matches(item, 'assignee')),
    open_blockers: dashboard.open_blockers.filter((item) => matches(item, 'agent_id')),
    pending_approvals: dashboard.pending_approvals.filter((item) => matches(item, 'agent_id')),
  }
}

function describeScope(options = {}) {
  const parts = []
  if (options.agent) parts.push(`agent=${options.agent}`)
  if (options.channelBinding) parts.push(`@ ${options.channelBinding}`)
  return parts.length ? ` for ${parts.join(' ')}` : ''
}

function listOpenTasks(dashboard) {
  return (dashboard.task_items || []).filter((task) => task.status !== 'done' && task.status !== 'completed' && task.status !== 'cancelled')
}

function classifyAgent(agent, jobs) {
  const logicalAgent = agent.agent_id || agent.name
  const relevantJobs = jobs.filter((job) => job.agent === logicalAgent || job.agent === agent.name)
  const inProgress = relevantJobs.find((job) => ["running", "dispatched"].includes(job.status)) || null
  const queued = relevantJobs.find((job) => ["queued", "assigned"].includes(job.status)) || null
  const now = Date.now()
  const updatedMs = agent.updated ? Date.parse(agent.updated) : NaN
  const ageMinutes = Number.isNaN(updatedMs) ? null : Math.floor((now - updatedMs) / 60000)

  let runtime_state = 'alive-idle'
  if (!agent.sessionID) {
    runtime_state = 'dead'
  } else if (inProgress) {
    runtime_state = 'alive-working'
  } else if (queued) {
    runtime_state = 'alive-runnable'
  } else if (ageMinutes != null && ageMinutes > 180) {
    runtime_state = 'stale'
  }

  return {
    ...agent,
    runtime_state,
    active_job_id: inProgress?.id || queued?.id || null,
    active_job_type: inProgress?.type || queued?.type || null,
    updated_age_minutes: ageMinutes,
  }
}
