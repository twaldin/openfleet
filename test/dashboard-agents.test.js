const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const net = require("node:net")
const vm = require("node:vm")
const { spawn } = require("node:child_process")

const dashboardHtml = fs.readFileSync(path.join(__dirname, "..", "core", "dashboard.html"), "utf8")

function tempStateDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openfleet-dashboard-agents-"))
}

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, () => {
      const address = server.address()
      server.close(() => resolve(address.port))
    })
    server.on("error", reject)
  })
}

async function waitForServer(baseUrl) {
  const deadline = Date.now() + 5000
  let lastError = null
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl)
      await response.text()
      return
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
  throw lastError || new Error(`Timed out waiting for ${baseUrl}`)
}

async function startDashboard(stateRoot, t) {
  const port = await getAvailablePort()
  const child = spawn("node", [path.join(__dirname, "..", "bin", "dashboard"), "--port", String(port)], {
    env: {
      ...process.env,
      OPENFLEET_CANONICAL_STATE_DIR: stateRoot,
      OPENFLEET_DASHBOARD_SSE_INTERVAL_MS: "100",
    },
    stdio: ["ignore", "pipe", "pipe"],
  })

  t.after(async () => {
    if (child.exitCode === null) {
      child.kill("SIGTERM")
      await new Promise((resolve) => child.once("exit", resolve))
    }
  })

  await waitForServer(`http://127.0.0.1:${port}/`)
  return { baseUrl: `http://127.0.0.1:${port}` }
}

function readToken(stateRoot) {
  const config = JSON.parse(fs.readFileSync(path.join(stateRoot, "remote.json"), "utf8"))
  return config.auth.token
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function isoMinutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString()
}

function extractDashboardFunctionSource(name) {
  const start = dashboardHtml.indexOf(`function ${name}(`)
  assert.notEqual(start, -1, `Unable to find function ${name}`)

  let braceIndex = dashboardHtml.indexOf("{", start)
  let depth = 0
  for (let index = braceIndex; index < dashboardHtml.length; index += 1) {
    const char = dashboardHtml[index]
    if (char === "{") depth += 1
    if (char === "}") {
      depth -= 1
      if (depth === 0) {
        return dashboardHtml.slice(start, index + 1)
      }
    }
  }

  throw new Error(`Unable to parse function ${name}`)
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

class FakeTextNode {
  constructor(text) {
    this.textContent = String(text)
  }

  get outerHTML() {
    return escapeHtml(this.textContent)
  }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase()
    this.children = []
    this.dataset = {}
    this.attributes = {}
    this.listeners = {}
    this.className = ""
    this.type = ""
    this._textContent = null
    this._innerHTML = null
  }

  appendChild(child) {
    this._textContent = null
    this._innerHTML = null
    this.children.push(child)
    return child
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value)
  }

  addEventListener(type, listener) {
    this.listeners[type] = listener
  }

  set textContent(value) {
    this._textContent = String(value)
    this._innerHTML = null
    this.children = []
  }

  get textContent() {
    if (this._textContent !== null) return this._textContent
    if (this._innerHTML !== null) return this._innerHTML
    return this.children.map((child) => child.textContent || "").join("")
  }

  set innerHTML(value) {
    this._innerHTML = String(value)
    this._textContent = null
    this.children = value === "" ? [] : this.children
  }

  get innerHTML() {
    if (this._innerHTML !== null) return this._innerHTML
    if (this._textContent !== null) return escapeHtml(this._textContent)
    return this.children.map((child) => child.outerHTML || escapeHtml(child.textContent || "")).join("")
  }

  get outerHTML() {
    const attributes = []
    if (this.className) attributes.push(`class="${escapeHtml(this.className)}"`)
    for (const [name, value] of Object.entries(this.attributes)) {
      attributes.push(`${name}="${escapeHtml(value)}"`)
    }
    const suffix = attributes.length > 0 ? ` ${attributes.join(" ")}` : ""
    return `<${this.tagName.toLowerCase()}${suffix}>${this.innerHTML}</${this.tagName.toLowerCase()}>`
  }
}

function loadDashboardRenderContext() {
  const elements = new Map()
  const document = {
    createElement(tagName) {
      return new FakeElement(tagName)
    },
    createTextNode(text) {
      return new FakeTextNode(text)
    },
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, new FakeElement("div"))
      }
      return elements.get(id)
    },
  }

  const context = {
    document,
    selectedAgent: null,
    agents: [],
    pastAgentsExpanded: false,
    selectAgent() {},
    $agentList: document.getElementById("agent-list"),
    $agentCount: document.getElementById("agent-count"),
  }

  vm.createContext(context)
  for (const name of ["esc", "isPastAgent", "renderAgentRow", "renderAgentSection", "renderAgents"]) {
    vm.runInContext(extractDashboardFunctionSource(name), context)
  }
  return context
}

test("dashboard status includes alive and dead agent state", async (t) => {
  const stateRoot = tempStateDir()
  writeJson(path.join(stateRoot, "agents.json"), {
    agents: {
      "coder-live": { name: "coder-live", role: "ephemeral", harness: "opencode", model: "gpt-5.4" },
      "coder-dead": { name: "coder-dead", role: "ephemeral", harness: "codex", model: "gpt-5.4-mini" },
    },
  })
  writeJson(path.join(stateRoot, "registry.json"), {
    sessions: {
      live: {
        session_id: "live",
        name: "coder-live",
        role: "ephemeral",
        harness: "opencode",
        model: "gpt-5.4",
        updated_at: isoMinutesAgo(2),
      },
      dead: {
        session_id: "dead",
        name: "coder-dead",
        role: "ephemeral",
        harness: "codex",
        model: "gpt-5.4-mini",
        updated_at: isoMinutesAgo(20),
      },
    },
  })

  const { baseUrl } = await startDashboard(stateRoot, t)
  const token = readToken(stateRoot)
  const response = await fetch(`${baseUrl}/api/status`, { headers: authHeaders(token) })
  const data = await response.json()

  const liveAgent = data.agents.find((agent) => agent.name === "coder-live")
  const deadAgent = data.agents.find((agent) => agent.name === "coder-dead")

  assert.equal(liveAgent.alive, true)
  assert.equal(liveAgent.status, "alive")
  assert.equal(deadAgent.alive, false)
  assert.equal(deadAgent.status, "dead")
})

test("dashboard status sorts alive agents before dead agents", async (t) => {
  const stateRoot = tempStateDir()
  writeJson(path.join(stateRoot, "agents.json"), {
    agents: {
      "aaa-dead": { name: "aaa-dead", role: "ephemeral", harness: "codex" },
      "zzz-live": { name: "zzz-live", role: "ephemeral", harness: "opencode" },
    },
  })
  writeJson(path.join(stateRoot, "registry.json"), {
    sessions: {
      live: {
        session_id: "live",
        name: "zzz-live",
        role: "ephemeral",
        updated_at: isoMinutesAgo(2),
      },
      dead: {
        session_id: "dead",
        name: "aaa-dead",
        role: "ephemeral",
        updated_at: isoMinutesAgo(20),
      },
    },
  })

  const { baseUrl } = await startDashboard(stateRoot, t)
  const token = readToken(stateRoot)
  const response = await fetch(`${baseUrl}/api/status`, { headers: authHeaders(token) })
  const data = await response.json()

  assert.deepEqual(data.agents.map((agent) => agent.name), ["zzz-live", "aaa-dead"])
})

test("dashboard status includes the orchestrator as cairn", async (t) => {
  const stateRoot = tempStateDir()
  writeJson(path.join(stateRoot, "orchestrator.json"), {
    profile_id: "main",
    harness: "claude-code",
    model: "opus-4.6",
    tmux_session: "openfleet",
    tmux_window: "cairn",
    workdir: "~/openfleet",
    activated_at: isoMinutesAgo(1),
  })

  const { baseUrl } = await startDashboard(stateRoot, t)
  const token = readToken(stateRoot)
  const response = await fetch(`${baseUrl}/api/status`, { headers: authHeaders(token) })
  const data = await response.json()

  assert.equal(data.agents[0]?.name, "cairn")
  assert.equal(data.agents[0]?.role, "orchestrator")
})

test("dashboard agents endpoint exposes split-driving role and liveness data", async (t) => {
  const stateRoot = tempStateDir()
  writeJson(path.join(stateRoot, "agents.json"), {
    agents: {
      "coder-live": { name: "coder-live", role: "ephemeral", harness: "opencode", model: "gpt-5.4" },
      "researcher": { name: "researcher", role: "persistent", harness: "claude-code", model: "opus-4.6" },
      "coder-past": { name: "coder-past", role: "ephemeral", harness: "codex", model: "gpt-5.4-mini" },
    },
  })
  writeJson(path.join(stateRoot, "registry.json"), {
    sessions: {
      live: {
        session_id: "live",
        name: "coder-live",
        role: "ephemeral",
        harness: "opencode",
        model: "gpt-5.4",
        updated_at: isoMinutesAgo(1),
      },
      past: {
        session_id: "past",
        name: "coder-past",
        role: "ephemeral",
        harness: "codex",
        model: "gpt-5.4-mini",
        updated_at: isoMinutesAgo(20),
      },
    },
  })

  const { baseUrl } = await startDashboard(stateRoot, t)
  const token = readToken(stateRoot)
  const response = await fetch(`${baseUrl}/api/agents`, { headers: authHeaders(token) })
  const data = await response.json()

  assert.equal(data.agent_count, 3)
  assert.equal(data.alive_count, 1)

  const byName = new Map(data.agents.map((agent) => [agent.name, agent]))
  assert.equal(byName.get("coder-live")?.alive, true)
  assert.equal(byName.get("coder-live")?.status, "alive")
  assert.equal(byName.get("researcher")?.alive, false)
  assert.equal(byName.get("researcher")?.status, "dormant")
  assert.equal(byName.get("coder-past")?.alive, false)
  assert.equal(byName.get("coder-past")?.status, "dead")

  const pastAgentNames = data.agents
    .filter((agent) => agent.role === "ephemeral" && !agent.alive)
    .map((agent) => agent.name)
  assert.deepEqual(pastAgentNames, ["coder-past"])
})

test("dashboard agent rows escape HTML in agent names", () => {
  const context = loadDashboardRenderContext()
  const row = context.renderAgentRow({
    name: '<script>alert("xss")</script>',
    harness: "opencode",
    model: "gpt-5.4",
    role: "ephemeral",
    status: "alive",
  }, false)

  assert.match(row.innerHTML, /&lt;script&gt;alert\(&quot;xss&quot;\)&lt;\/script&gt;/)
  assert.doesNotMatch(row.innerHTML, /<script>/)
})

test("dashboard renderer splits active and past agents and shows the past count as a badge", () => {
  const context = loadDashboardRenderContext()
  context.renderAgents([
    { name: "coder-live", role: "ephemeral", alive: true, status: "alive", harness: "opencode", model: "gpt-5.4" },
    { name: "researcher", role: "persistent", alive: false, status: "dormant", harness: "claude-code", model: "opus-4.6" },
    { name: "coder-past", role: "ephemeral", alive: false, status: "dead", harness: "codex", model: "gpt-5.4-mini" },
  ])

  assert.equal(context.$agentCount.textContent, "3")
  assert.equal(context.$agentList.children.length, 2)

  const activeSection = context.$agentList.children[0]
  assert.equal(activeSection.children[0].children[0].children[0].textContent, "Active Agents")
  assert.equal(activeSection.children[0].children[1].textContent, "2")
  assert.equal(activeSection.children.length, 3)

  const pastSection = context.$agentList.children[1]
  const pastTitleGroup = pastSection.children[0].children[0]
  assert.equal(pastTitleGroup.className, "agent-section-title-group")
  assert.equal(pastTitleGroup.children[0].textContent, "Past Agents")
  assert.equal(pastTitleGroup.children[1].className, "agent-section-count-badge")
  assert.equal(pastTitleGroup.children[1].textContent, "1")
  assert.equal(pastSection.children[0].children[1].textContent, "Show")
  assert.equal(pastSection.children.length, 1)
})
