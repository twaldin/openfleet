const fs = require("fs")
const os = require("os")
const path = require("path")
const { spawn } = require("child_process")

function parseArgs(argv) {
  const options = { _: [] }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]

    if (!arg.startsWith("--")) {
      options._.push(arg)
      continue
    }

    const eqIndex = arg.indexOf("=")
    if (eqIndex !== -1) {
      const key = arg.slice(2, eqIndex)
      const value = arg.slice(eqIndex + 1)
      options[key] = value
      continue
    }

    const key = arg.slice(2)
    const next = argv[i + 1]
    if (next && !next.startsWith("--")) {
      options[key] = next
      i += 1
    } else {
      options[key] = true
    }
  }

  return options
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"))
  } catch {
    return null
  }
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function buildBaseUrl(host, port) {
  return `http://${host}:${port}`
}

async function request(baseUrl, method, pathname, { directory, body } = {}) {
  const url = new URL(pathname, baseUrl)
  if (directory) {
    url.searchParams.set("directory", directory)
  }

  const response = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`${method} ${url.pathname} failed: ${response.status} ${text}`)
  }

  if (response.status === 204 || response.status === 205) {
    return null
  }

  return response.json()
}

async function ensureOpencodeServer({ host, port, stateDir, logDir }) {
  const baseUrl = buildBaseUrl(host, port)
  const pidFile = path.join(stateDir, "opencode-server.pid")
  const logFile = path.join(logDir, "opencode-server.log")

  ensureDir(stateDir)
  ensureDir(logDir)

  if (await isHealthy(baseUrl)) {
    return baseUrl
  }

  if (fs.existsSync(pidFile)) {
    const pid = Number(fs.readFileSync(pidFile, "utf8").trim())
    if (!Number.isNaN(pid)) {
      try {
        process.kill(pid, 0)
      } catch {
        fs.rmSync(pidFile, { force: true })
      }
    }
  }

  const out = fs.openSync(logFile, "a")
  const child = spawn("opencode", ["serve", "--hostname", host, "--port", String(port)], {
    detached: true,
    stdio: ["ignore", out, out],
  })
  child.unref()
  fs.writeFileSync(pidFile, `${child.pid}\n`)

  for (let i = 0; i < 20; i += 1) {
    if (await isHealthy(baseUrl)) {
      return baseUrl
    }
    await sleep(1000)
  }

  throw new Error(`OpenCode server failed to become healthy at ${baseUrl}`)
}

async function isHealthy(baseUrl) {
  try {
    await request(baseUrl, "GET", "/global/health")
    return true
  } catch {
    return false
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function loadCachedSessionId(sessionFile) {
  return readJson(sessionFile)?.sessionID || null
}

function saveSessionMetadata(sessionFile, metadata) {
  writeJson(sessionFile, metadata)
}

function resolveSender({ workspaceRoot, stateDir }) {
  if (process.env.AGENT_NAME) {
    return process.env.AGENT_NAME
  }

  const cwd = process.cwd()
  const agentsPrefix = `${workspaceRoot}/agents/`
  if (cwd.startsWith(agentsPrefix)) {
    const relative = cwd.slice(agentsPrefix.length)
    const name = relative.split(path.sep)[0]
    if (name) {
      return name
    }
  }

  try {
    for (const entry of fs.readdirSync(stateDir)) {
      if (!entry.endsWith(".json")) {
        continue
      }

      const metadata = readJson(path.join(stateDir, entry))
      if (metadata?.directory === cwd) {
        return metadata.name
      }
    }
  } catch {
    // ignore
  }

  return path.basename(cwd) || "worker"
}

module.exports = {
  ensureDir,
  ensureOpencodeServer,
  loadCachedSessionId,
  parseArgs,
  readJson,
  request,
  resolveSender,
  saveSessionMetadata,
  writeJson,
}
