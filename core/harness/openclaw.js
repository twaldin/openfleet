const { execFileSync } = require("child_process")
const crypto = require("crypto")

function buildSpawnCommand(name, model, port, workdir, token = null) {
  const parts = []
  if (token) {
    parts.push(`OPENCLAW_TOKEN=${shellQuote(token)}`)
  }
  parts.push("openclaw", "--headless", "--port", String(port), "--model", shellQuote(model))
  return parts.join(" ")
}

async function sendMessage(port, token, message, fetchImpl = global.fetch) {
  const response = await fetchImpl(`http://127.0.0.1:${port}/api/channels/openfleet/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  })

  if (!response.ok) {
    throw new Error(`OpenClaw message request failed with status ${response.status}`)
  }

  return response
}

async function checkHealth(port, fetchImpl = global.fetch) {
  try {
    const response = await fetchImpl(`http://127.0.0.1:${port}/api/health`, {
      method: "GET",
    })
    return Boolean(response.ok)
  } catch {
    return false
  }
}

async function shutdownOpenClaw(port, token, fetchImpl = global.fetch) {
  const response = await fetchImpl(`http://127.0.0.1:${port}/api/shutdown`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error(`OpenClaw shutdown request failed with status ${response.status}`)
  }

  return response
}

function generateToken() {
  return crypto.randomBytes(32).toString("hex")
}

function ensureOpenClawBinary({ execImpl = execFileSync } = {}) {
  try {
    execImpl("openclaw", ["--help"], { stdio: "ignore" })
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error("OpenClaw binary not found. Install `openclaw` and ensure it is on your PATH.")
    }
    throw error
  }
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}

module.exports = {
  buildSpawnCommand,
  checkHealth,
  ensureOpenClawBinary,
  generateToken,
  sendMessage,
  shutdownOpenClaw,
}
