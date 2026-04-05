const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { handleRequest, listTools } = require('../core/mcp')

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
  assert.ok(tools.find((tool) => tool.name === 'openfleet_dashboard'))
  assert.equal(tools.find((tool) => tool.name === 'openfleet_tasks'), undefined)
})
