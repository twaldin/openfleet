const os = require('os')
const path = require('path')
const { listJobs } = require('./runtime/jobs')
const { listAgentMetadata, fetchSessionMessages, renderMessages } = require('./ops')

async function listStalledJobs(stateRoot) {
  const jobs = listJobs(stateRoot).filter((job) => ['running', 'dispatched'].includes(job.status))
  const agents = listAgentMetadata(stateRoot)
  const byName = new Map(agents.map((a) => [a.name, a]))
  const results = []

  for (const job of jobs) {
    const metadata = byName.get(job.output?.execution?.session || job.agent) || byName.get(job.agent)
    if (!metadata) continue
    try {
      const messages = await fetchSessionMessages({
        metadata,
        serverStateDir: path.join(os.homedir(), '.cairn', 'system', 'opencode'),
        serverLogDir: path.join(os.homedir(), '.cairn', 'system', 'logs'),
      })
      const rendered = renderMessages(messages, 12)
      const last = [...rendered].reverse().find((m) => m.role === 'assistant')
      if (last && last.finish === 'stop') {
        results.push({
          job,
          metadata,
          lastAssistant: last,
        })
      }
    } catch {
      // ignore fetch failures for now
    }
  }

  return results
}

module.exports = {
  listStalledJobs,
}
