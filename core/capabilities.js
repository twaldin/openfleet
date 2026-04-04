const fs = require("fs")
const path = require("path")

const CAPABILITY_TYPES = new Set(["skills", "mcp", "hooks", "permissions"])
const PROJECTION_TYPES = new Set(["file", "append", "json"])

function capabilitiesRoot(options = {}) {
  return path.resolve(options.capabilitiesRoot || path.join(__dirname, "..", "capabilities"))
}

function loadCapabilityIndex(options = {}) {
  const root = capabilitiesRoot(options)
  const targetPath = path.join(root, "index.json")
  const parsed = JSON.parse(fs.readFileSync(targetPath, "utf8"))

  if (!isPlainObject(parsed) || !isPlainObject(parsed.capabilities)) {
    throw new Error(`Invalid capability index: ${targetPath}`)
  }

  return parsed.capabilities
}

function loadCapability(name, options = {}) {
  if (typeof name !== "string" || !name.trim()) {
    throw new Error("Capability name is required")
  }

  const root = capabilitiesRoot(options)
  const index = loadCapabilityIndex(options)
  const relativePath = index[name]

  if (typeof relativePath !== "string" || !relativePath) {
    throw new Error(`Capability not found: ${name}`)
  }

  const targetPath = path.join(root, relativePath)
  const capability = JSON.parse(fs.readFileSync(targetPath, "utf8"))
  validateCapabilitySchema(capability, targetPath)

  if (capability.name !== name) {
    throw new Error(`Capability name mismatch in ${targetPath}: expected ${name}, got ${capability.name}`)
  }

  return capability
}

function loadCapabilities(names, options = {}) {
  if (!Array.isArray(names)) {
    throw new Error("Capability names must be an array")
  }

  return names.map((name) => loadCapability(name, options))
}

function validateCapabilitySchema(capability, source = "capability") {
  if (!isPlainObject(capability)) {
    throw new Error(`Invalid capability schema in ${source}: capability must be an object`)
  }

  if (typeof capability.name !== "string" || !capability.name.trim()) {
    throw new Error(`Invalid capability schema in ${source}: name is required`)
  }

  if (!CAPABILITY_TYPES.has(capability.type)) {
    throw new Error(`Invalid capability schema in ${source}: type must be one of ${Array.from(CAPABILITY_TYPES).join(", ")}`)
  }

  if (typeof capability.description !== "string" || !capability.description.trim()) {
    throw new Error(`Invalid capability schema in ${source}: description is required`)
  }

  if (!isPlainObject(capability.projections)) {
    throw new Error(`Invalid capability schema in ${source}: projections must be an object`)
  }

  for (const [harness, projection] of Object.entries(capability.projections)) {
    validateProjectionSchema(projection, source, harness)
  }

  return capability
}

function resolveCapabilityProjection(capability, harness) {
  validateCapabilitySchema(capability, capability?.name || "capability")

  if (typeof harness !== "string" || !harness.trim()) {
    throw new Error("harness is required")
  }

  return capability.projections[harness] || null
}

function writeCapabilityProjection(capability, harness, workdir) {
  if (!workdir) {
    throw new Error("workdir is required")
  }

  const projection = resolveCapabilityProjection(capability, harness)
  if (!projection) return null

  const resolvedWorkdir = path.resolve(workdir)
  const targetPath = resolveProjectionPath(resolvedWorkdir, projection.content.path)

  fs.mkdirSync(path.dirname(targetPath), { recursive: true })

  if (projection.type === "file") {
    fs.writeFileSync(targetPath, ensureTrailingNewline(projection.content.value), "utf8")
    return targetPath
  }

  if (projection.type === "append") {
    const current = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, "utf8") : ""
    const prefix = current && !current.endsWith("\n") ? "\n" : ""
    fs.writeFileSync(targetPath, `${current}${prefix}${ensureTrailingNewline(projection.content.value)}`, "utf8")
    return targetPath
  }

  if (projection.type === "json") {
    fs.writeFileSync(targetPath, `${JSON.stringify(projection.content.value, null, 2)}\n`, "utf8")
    return targetPath
  }

  throw new Error(`Unsupported capability projection type: ${projection.type}`)
}

function validateProjectionSchema(projection, source, harness) {
  if (!isPlainObject(projection)) {
    throw new Error(`Invalid capability schema in ${source}: projection for ${harness} must be an object`)
  }

  if (!PROJECTION_TYPES.has(projection.type)) {
    throw new Error(`Invalid capability schema in ${source}: projection type for ${harness} must be one of ${Array.from(PROJECTION_TYPES).join(", ")}`)
  }

  if (!isPlainObject(projection.content)) {
    throw new Error(`Invalid capability schema in ${source}: projection content for ${harness} must be an object`)
  }

  if (typeof projection.content.path !== "string" || !projection.content.path.trim()) {
    throw new Error(`Invalid capability schema in ${source}: projection path for ${harness} is required`)
  }

  if (projection.type === "json") {
    if (!Object.prototype.hasOwnProperty.call(projection.content, "value")) {
      throw new Error(`Invalid capability schema in ${source}: projection value for ${harness} is required`)
    }
    return
  }

  if (typeof projection.content.value !== "string") {
    throw new Error(`Invalid capability schema in ${source}: projection value for ${harness} must be a string`)
  }
}

function resolveProjectionPath(workdir, relativePath) {
  if (path.isAbsolute(relativePath)) {
    throw new Error(`Capability projection path must be relative: ${relativePath}`)
  }

  const targetPath = path.resolve(workdir, relativePath)
  const relative = path.relative(workdir, targetPath)

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Capability projection path escapes workdir: ${relativePath}`)
  }

  return targetPath
}

function ensureTrailingNewline(text) {
  return text.endsWith("\n") ? text : `${text}\n`
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

module.exports = {
  capabilitiesRoot,
  loadCapability,
  loadCapabilityIndex,
  loadCapabilities,
  resolveCapabilityProjection,
  validateCapabilitySchema,
  writeCapabilityProjection,
}
