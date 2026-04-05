const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

const {
  buildRemoteTmuxSpawnCommand,
  buildRemoteMkdirCommand,
  buildHarnessLaunchCommand,
  checkRemoteDependencies,
  hostsFilePath,
  loadHosts,
} = require("../core/remote/ssh")
const { isAlive } = require("../bin/agent-lifecycle")

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openfleet-ssh-spawn-"))
}

test("loadHosts returns default schema when hosts.json is missing", () => {
  const stateRoot = tempDir()
  assert.deepEqual(loadHosts(hostsFilePath(stateRoot)), { hosts: {} })
})

test("loadHosts parses registered hosts", () => {
  const stateRoot = tempDir()
  const filePath = hostsFilePath(stateRoot)
  fs.writeFileSync(filePath, `${JSON.stringify({
    hosts: {
      "thinkpad-1": {
        ip: "100.100.96.7",
        user: "twaldin",
        ssh_key: "~/.ssh/id_ed25519",
        bootstrapped: false,
        installed: [],
      },
    },
  }, null, 2)}\n`)

  const hosts = loadHosts(filePath)

  assert.equal(hosts.hosts["thinkpad-1"].ip, "100.100.96.7")
  assert.equal(hosts.hosts["thinkpad-1"].user, "twaldin")
  assert.equal(hosts.hosts["thinkpad-1"].ssh_key, "~/.ssh/id_ed25519")
})

test("checkRemoteDependencies classifies installed and missing remote commands", () => {
  const seen = []
  const result = checkRemoteDependencies({ ip: "100.100.96.7", user: "twaldin" }, "claude-code", {
    exec(file, args) {
      seen.push({ file, args })
      return [
        "tmux\tinstalled",
        "node\tinstalled",
        "rsync\tmissing",
        "claude\tmissing",
        "",
      ].join("\n")
    },
  })

  assert.equal(seen.length, 1)
  assert.equal(seen[0].file, "ssh")
  assert.match(seen[0].args[seen[0].args.length - 1], /command -v/) 
  assert.deepEqual(result.installed, ["tmux", "node"])
  assert.deepEqual(result.missing, ["rsync", "claude"])
})

test("buildHarnessLaunchCommand builds remote opencode launch command", () => {
  const launch = buildHarnessLaunchCommand({
    harness: "opencode",
    model: "gpt-5.4",
    workdir: "~/.openfleet/workspaces/ssh-coder",
    name: "ssh-coder",
  })

  // Launch command is now a script file
  assert.match(launch.command, /openfleet-launch-ssh-coder\.sh/)
  assert.equal(typeof launch.opencodePort, "number")
  const fs = require("fs")
  const script = fs.readFileSync(launch.command, "utf8")
  assert.match(script, /opencode serve --port/)
  assert.match(script, /opencode attach http:\/\/127\.0\.0\.1:/)
  assert.match(script, /openfleet\/workspaces\/ssh-coder/)
  assert.match(script, /OPENFLEET_AGENT_NAME/)
})

test("buildRemoteTmuxSpawnCommand creates remote tmux bootstrap command", () => {
  const command = buildRemoteTmuxSpawnCommand({
    tmuxSession: "openfleet",
    windowName: "ssh-coder",
    workdir: "~/.openfleet/workspaces/ssh-coder",
    launchCommand: "claude --dangerously-skip-permissions --model opus-4.6",
  })

  assert.match(command, /mkdir -p/)
  assert.match(command, /tmux has-session -t 'openfleet'/)
  assert.match(command, /tmux kill-window -t 'openfleet:ssh-coder'/)
  assert.match(command, /tmux new-window -t 'openfleet' -n 'ssh-coder'/)
  assert.match(command, /claude --dangerously-skip-permissions --model opus-4\.6/)
})

test("buildRemoteMkdirCommand safely quotes remote-dir paths with spaces and quotes", () => {
  const command = buildRemoteMkdirCommand("~/OpenFleet Workers/agent's dir")

  assert.equal(command, "mkdir -p '~/OpenFleet Workers/agent'\\''s dir'")
})

test("isAlive returns false for remote SSH failure without falling back to local tmux", () => {
  let localChecks = 0

  const alive = isAlive({
    host: "thinkpad-1",
    tmux_session: "openfleet",
    tmux_window: "ssh-coder",
  }, {
    getHostImpl() {
      return { ip: "100.100.96.7", user: "twaldin" }
    },
    hostsFilePathImpl() {
      return "/tmp/hosts.json"
    },
    runSshCommandImpl() {
      throw new Error("ssh timeout")
    },
    execImpl() {
      localChecks += 1
      return "ssh-coder\n"
    },
  })

  assert.equal(alive, false)
  assert.equal(localChecks, 0)
})
