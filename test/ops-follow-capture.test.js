const test = require('node:test')
const assert = require('node:assert/strict')

const { buildCaptureSurface, buildFollowSurface } = require('../core/ops')

test('buildCaptureSurface renders agent transcript snapshot', () => {
  const surface = buildCaptureSurface({
    metadata: {
      name: 'coder',
      agent_id: 'coder',
      runtime_instance_id: 'coder-gpt@macbook',
      sessionID: 'sess_123',
      agentProfile: 'coder-gpt',
      location: 'local',
      host: 'macbook',
      baseUrl: null,
    },
    messages: [
      { role: 'assistant', provider: 'openai', model: 'gpt-5.4', finish: 'stop', text: 'Implemented fix.', partTypes: ['text'] },
    ],
  })

  assert.match(surface, /agent=coder instance=coder-gpt@macbook session=sess_123 model=coder-gpt location=local host=macbook baseUrl=-/)
  assert.match(surface, /\[assistant\] provider=openai model=gpt-5.4 finish=stop/)
  assert.match(surface, /Implemented fix\./)
})

test('buildFollowSurface renders only new follow messages', () => {
  const surface = buildFollowSurface({
    metadata: {
      name: 'coder',
      agent_id: 'coder',
      runtime_instance_id: 'coder-gpt@macbook',
      sessionID: 'sess_123',
      agentProfile: 'coder-gpt',
      location: 'local',
      host: 'macbook',
      baseUrl: null,
    },
    messages: [
      { role: 'assistant', provider: 'openai', model: 'gpt-5.4', finish: 'stop', text: 'Old message', partTypes: ['text'] },
      { role: 'assistant', provider: 'openai', model: 'gpt-5.4', finish: 'stop', text: 'New message', partTypes: ['text'] },
    ],
    lastCount: 1,
  })

  assert.match(surface, /agent=coder instance=coder-gpt@macbook session=sess_123/)
  assert.match(surface, /New message/)
  assert.doesNotMatch(surface, /Old message/)
})

test('buildFollowSurface renders empty-state polish when no new messages exist', () => {
  const surface = buildFollowSurface({
    metadata: {
      name: 'coder',
      agent_id: 'coder',
      runtime_instance_id: 'coder-gpt@macbook',
      sessionID: 'sess_123',
      agentProfile: 'coder-gpt',
      location: 'local',
      host: 'macbook',
      baseUrl: null,
    },
    messages: [
      { role: 'assistant', provider: 'openai', model: 'gpt-5.4', finish: 'stop', text: 'Old message', partTypes: ['text'] },
    ],
    lastCount: 1,
  })

  assert.match(surface, /No new messages\./)
})
