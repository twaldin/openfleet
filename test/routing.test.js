const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const { loadDeploymentConfig } = require('../core/deployment')
const { resolveChannelBinding, resolveInboundRoute } = require('../core/routing')

test('deployment exposes persistent agent channel mappings', () => {
  const deployment = loadDeploymentConfig(path.join(__dirname, '..', 'examples', 'cairn', 'deployment.json'))

  assert.equal(deployment.routing.assistant_channel, 'channel://lifeos')
  assert.equal(deployment.routing.persistent_agent_channels.coder, 'channel://code-status')
  assert.equal(deployment.routing.persistent_agent_channels['stock-monitor'], 'channel://investing')
  assert.equal(deployment.routing.server_architecture.server_name, 'OpenFleet')
  assert.equal(deployment.routing.server_architecture.status_channel, 'channel://fleet-status')
  assert.deepEqual(deployment.routing.server_architecture.categories.map((category) => category.name), ['control-plane', 'workers'])
})

test('resolveChannelBinding prefers persistent agent channels before default human channel', () => {
  const routing = {
    assistant_channel: 'channel://lifeos',
    direct_message_policy: 'agent-channel-preferred',
    persistent_agent_channels: {
      coder: 'channel://code-status',
    },
  }

  assert.equal(resolveChannelBinding(routing, { agent: 'coder' }), 'channel://code-status')
  assert.equal(resolveChannelBinding(routing, { agent: 'monitor' }), 'channel://lifeos')
})

test('resolveInboundRoute sends direct specialist messages to mapped persistent agent channel', () => {
  const routing = {
    assistant_channel: 'channel://lifeos',
    direct_message_policy: 'agent-channel-preferred',
    persistent_agent_channels: {
      coder: 'channel://code-status',
    },
  }

  const routed = resolveInboundRoute(routing, {
    targetAgent: 'coder',
    isDirectMessage: true,
  })

  assert.deepEqual(routed, {
    mode: 'direct-agent',
    agent: 'coder',
    channel_binding: 'channel://code-status',
  })
})

test('deployment exposes clean Discord server channel architecture', () => {
  const deployment = loadDeploymentConfig(path.join(__dirname, '..', 'examples', 'cairn', 'deployment.json'))
  const architecture = deployment.routing.server_architecture

  assert.equal(architecture.blocker_channel, 'channel://fleet-blockers')
  assert.equal(architecture.approval_channel, 'channel://fleet-approvals')
  assert.deepEqual(architecture.categories[0].channels, [
    'channel://lifeos',
    'channel://fleet-status',
    'channel://fleet-blockers',
    'channel://fleet-approvals',
  ])
})
