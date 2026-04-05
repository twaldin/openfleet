const { buildDashboard } = require('./ops')

function renderOpsTui(stateRoot, options = {}) {
  const dashboard = buildDashboard(stateRoot)
  const width = options.width || 100
  const leftWidth = Math.floor(width * 0.56)
  const rightWidth = width - leftWidth - 3

  const agents = [
    'Agents',
    ...(dashboard.agents.length
      ? dashboard.agents.slice(0, 8).map((agent) => `${agent.agent_id || agent.name} | ${agent.runtime_instance_id || agent.name} | ${compactState(agent.runtime_state)} | ${agent.agentProfile || 'unknown'}`)
      : ['none']),
  ]

  const jobs = [
    'Jobs',
    ...(dashboard.in_progress_jobs.length
      ? dashboard.in_progress_jobs.slice(0, 4).map((job) => `${job.type} -> ${job.agent || 'unassigned'} [${job.status}]`)
      : ['no in-progress jobs']),
    ...(dashboard.runnable_jobs.length
      ? dashboard.runnable_jobs.slice(0, 3).map((job) => `queued: ${job.type} -> ${job.agent || 'unassigned'}`)
      : []),
    `scheduled: ${dashboard.scheduled_jobs.length} | loops: ${dashboard.maintenance_loops.length}`,
  ]

  const left = [
    box('OpenFleet Ops', [
      `updated ${dashboard.generated_at}`,
      `counts agents=${dashboard.counts.agents} jobs=${dashboard.counts.jobs}`,
    ], leftWidth),
    box(agents[0], agents.slice(1), leftWidth),
  ]

  const right = [
    box(jobs[0], jobs.slice(1), rightWidth),
    box('Keys', ['r refresh', 'q quit', 'use: ops-ui --once for snapshot'], rightWidth),
  ]

  return joinColumns(left, right, leftWidth, rightWidth)
}

function compactState(state) {
  switch (state) {
    case 'alive-working': return 'working'
    case 'alive-runnable': return 'queued'
    case 'alive-idle': return 'idle'
    case 'stale': return 'stale'
    case 'dead': return 'dead'
    default: return state || 'unknown'
  }
}

function box(title, lines, width) {
  const inner = width - 4
  const titleText = truncate(` ${title} `, width - 4)
  const remaining = width - 2 - titleText.length
  const leftDashCount = 1
  const rightDashCount = Math.max(0, remaining - leftDashCount)
  const top = `┌${'─'.repeat(leftDashCount)}${titleText}${'─'.repeat(rightDashCount)}┐`
  const body = lines.map((line) => `│ ${pad(truncate(line, inner), inner)} │`)
  const bottom = `└${'─'.repeat(width - 2)}┘`
  return [top, ...body, bottom]
}

function joinColumns(leftBoxes, rightBoxes, leftWidth, rightWidth) {
  const left = leftBoxes.flatMap((boxLines) => [...boxLines, ''])
  const right = rightBoxes.flatMap((boxLines) => [...boxLines, ''])
  const max = Math.max(left.length, right.length)
  const rows = []
  for (let i = 0; i < max; i += 1) {
    rows.push(`${pad(left[i] || '', leftWidth)}   ${right[i] || ''}`.trimEnd())
  }
  return rows.join('\n')
}

function truncate(value, width) {
  return value.length > width ? `${value.slice(0, Math.max(0, width - 1))}…` : value
}

function pad(value, width, fill = ' ') {
  return `${value}${fill.repeat(Math.max(0, width - value.length))}`
}

module.exports = {
  box,
  renderOpsTui,
}
