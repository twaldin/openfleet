const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { handleRequest, listTools } = require('../core/mcp')
const { createTask } = require('../core/runtime/tasks')

function tempStateDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openfleet-mcp-'))
}

test('mcp initialize exposes tool capability', () => {
  const result = handleRequest(tempStateDir(), { method: 'initialize' })

  assert.equal(result.serverInfo.name, 'openfleet')
  assert.deepEqual(result.capabilities, { tools: {} })
})

test('mcp tool list exposes canonical OpenFleet tools', () => {
  const tools = listTools()
  assert.ok(tools.find((tool) => tool.name === 'openfleet_summary'))
  assert.ok(tools.find((tool) => tool.name === 'openfleet_tasks'))
  assert.ok(tools.find((tool) => tool.name === 'openfleet_dashboard'))
})

test('mcp tools/call returns structured task data', () => {
  const stateDir = tempStateDir()
  createTask(stateDir, {
    title: 'MCP task',
    status: 'active',
    assignee: 'coder',
  })

  const result = handleRequest(stateDir, {
    method: 'tools/call',
    params: { name: 'openfleet_tasks', arguments: {} },
  })

  assert.equal(result.structuredContent.data[0].title, 'MCP task')
  assert.match(result.content[0].text, /MCP task/)
})
