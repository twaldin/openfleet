// Remote provider adapter interface
// Each adapter module must export: { name, init, post, formatEvent, destroy }

const path = require("path")

const BUILTIN_ADAPTERS = {
  discord: "./discord-adapter",
}

function loadAdapter(providerName) {
  const builtinPath = BUILTIN_ADAPTERS[providerName]
  if (builtinPath) {
    return require(builtinPath)
  }
  throw new Error(`Unknown remote provider: ${providerName}`)
}

function createAdapter(providerName, providerConfig, stateRoot) {
  const adapter = loadAdapter(providerName)
  adapter.init(providerConfig, stateRoot)
  return adapter
}

module.exports = {
  createAdapter,
  loadAdapter,
}
