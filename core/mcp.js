const { buildDashboard, buildPresenceSurface, buildSummary, inspectAgent, listAgentMetadata } = require('./ops')
const { listJobs, getJob } = require('./runtime/jobs')

function listTools() {
  return [
    tool('openfleet_summary', 'Fleet summary and counts', { type: 'object', properties: {} }),
    tool('openfleet_presence', 'Agent presence summary', {
      type: 'object',
      properties: { agent: { type: 'string' } },
    }),
    tool('openfleet_agents', 'List agent metadata', { type: 'object', properties: {} }),
    tool('openfleet_agent_inspect', 'Inspect one agent', {
      type: 'object',
      properties: { agent: { type: 'string' }, limit: { type: 'number' } },
      required: ['agent'],
    }),
    tool('openfleet_jobs', 'List jobs or fetch one job', {
      type: 'object',
      properties: { id: { type: 'string' } },
    }),
    tool('openfleet_dashboard', 'Structured fleet dashboard', { type: 'object', properties: {} }),
  ]
}

function handleRequest(stateRoot, request) {
  if (request.method === 'initialize') {
    return {
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'openfleet', version: '0.1.0' },
      capabilities: { tools: {} },
    }
  }

  if (request.method === 'tools/list') {
    return { tools: listTools() }
  }

  if (request.method === 'tools/call') {
    return callTool(stateRoot, request.params?.name, request.params?.arguments || {})
  }

  throw new Error(`Unsupported MCP method: ${request.method}`)
}

function callTool(stateRoot, name, args) {
  switch (name) {
    case 'openfleet_summary':
      return result(buildSummary(stateRoot), { summary: buildSummary(stateRoot) })
    case 'openfleet_presence': {
      const surface = buildPresenceSurface(stateRoot, { agent: args.agent || null })
      return result(surface, { presence: surface })
    }
    case 'openfleet_agents':
      return resultJson(listAgentMetadata(stateRoot))
    case 'openfleet_agent_inspect':
      return resultJson(inspectAgent(stateRoot, args.agent, Number(args.limit || 20)))
    case 'openfleet_jobs':
      return resultJson(args.id ? getJob(stateRoot, args.id) : listJobs(stateRoot))
    case 'openfleet_dashboard':
      return resultJson(buildDashboard(stateRoot))
    default:
      throw new Error(`Unknown MCP tool: ${name}`)
  }
}

function tool(name, description, inputSchema) {
  return { name, description, inputSchema }
}

function result(text, structuredContent) {
  return {
    content: [{ type: 'text', text }],
    structuredContent,
  }
}

function resultJson(value) {
  return result(JSON.stringify(value, null, 2), { data: value })
}

module.exports = {
  callTool,
  handleRequest,
  listTools,
}
