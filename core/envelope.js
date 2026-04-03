function envelopeSystemMessage(target, message) {
  const name = normalizeTarget(target)
  return `[SYSTEM]: [${name}]: ${message}`
}

function normalizeTarget(target) {
  return String(target || 'AGENT')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase()
}

module.exports = {
  envelopeSystemMessage,
  normalizeTarget,
}
