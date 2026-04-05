const test = require("node:test")
const assert = require("node:assert/strict")

const { commands, renderHelp } = require("../bin/openfleet")
const { runRemoteAccess } = require("../bin/remote-access")

test("runRemoteAccess guides installation and setup when tailscale is missing", () => {
  const output = []

  const result = runRemoteAccess({
    authKey: "tskey-auth-kittens",
    writeLine: (line = "") => output.push(line),
    execFileSyncImpl() {
      const error = new Error("spawnSync tailscale ENOENT")
      error.code = "ENOENT"
      throw error
    },
  })

  assert.equal(result.ok, false)
  assert.match(output.join("\n"), /Tailscale CLI not found\./)
  assert.match(output.join("\n"), /Install Tailscale from https:\/\/tailscale\.com\/download/i)
  assert.match(output.join("\n"), /sudo tailscale up --auth-key tskey-auth-kittens/)
})

test("runRemoteAccess prints the Tailscale dashboard URL, auth token, and QR when connected", () => {
  const output = []
  const qrCalls = []

  const result = runRemoteAccess({
    writeLine: (line = "") => output.push(line),
    ensureAuthTokenImpl: () => "a".repeat(64),
    printQr: (url, details) => {
      qrCalls.push({ url, details })
      return true
    },
    execFileSyncImpl(file, args) {
      if (file !== "tailscale") {
        throw new Error(`Unexpected binary: ${file}`)
      }

      if (args[0] === "version") {
        return "1.78.0\n"
      }

      if (args[0] === "ip") {
        return "100.101.102.103\nfd7a:115c:a1e0::123\n"
      }

      throw new Error(`Unexpected tailscale args: ${args.join(" ")}`)
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.dashboardUrl, "http://100.101.102.103:3000")
  assert.match(output.join("\n"), /Tailscale IPv4: 100\.101\.102\.103/)
  assert.match(output.join("\n"), /Dashboard URL: http:\/\/100\.101\.102\.103:3000/)
  assert.match(output.join("\n"), /Dashboard auth token: a{64}/)
  assert.equal(qrCalls.length, 1)
  assert.equal(qrCalls[0].url, "http://100.101.102.103:3000")
  assert.equal(qrCalls[0].details.authToken, "a".repeat(64))
})

test("openfleet CLI exposes the remote-access command in its command table and help text", () => {
  assert.equal(typeof commands["remote-access"], "function")
  assert.match(renderHelp(), /remote-access\s+Tailscale dashboard access/)
})
