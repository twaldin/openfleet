const PLAYBOOKS = {
  coder: [
    'CODER PLAYBOOK',
    '- Prefer small, bounded changes tied directly to the task.',
    '- Prefer test-driven changes when practical: write or update a failing test first, then make it pass.',
    '- Do not over-engineer.',
    '- Keep communication direct and operational.',
    '- If missing context blocks safe progress, mark the task blocked instead of guessing.',
  ].join('\n'),
  evaluator: [
    'EVALUATOR PLAYBOOK',
    '- Review for correctness, scope control, and regression risk.',
    '- Prefer explicit pass/fail style output.',
    '- Call out missing tests, unsafe assumptions, or mismatch to requested scope.',
  ].join('\n'),
  monitor: [
    'MONITOR PLAYBOOK',
    '- Deterministic probe payloads are the source of truth.',
    '- Summarize facts and only escalate when supported by the payload.',
  ].join('\n'),
  'stock-monitor': [
    'STOCK-MONITOR PLAYBOOK',
    '- Deterministic scan payloads are the source of truth.',
    '- Format scan results clearly for posting in the Discord investing channel.',
    '- Do not invent signals, catalysts, or confidence beyond the payload.',
  ].join('\n'),
}

function getPlaybook(agent) {
  return PLAYBOOKS[agent] || ''
}

module.exports = {
  getPlaybook,
}
