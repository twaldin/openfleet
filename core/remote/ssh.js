const os = require("os")
const path = require("path")
const { execFileSync } = require("child_process")
const readline = require("node:readline/promises")
const { readJson, writeJson } = require("../../lib/opencode")
const { buildSpawnCommand: buildOpenClawSpawnCommand } = require("../harness/openclaw")

const DEFAULT_TMUX_SESSION = "openfleet"
const DEFAULT_REMOTE_ROOT = "~/.openfleet/workspaces"
const BASE_REMOTE_DEPENDENCIES = ["tmux", "node", "rsync"]
const HARNESS_DEPENDENCIES = {
  "claude-code": ["claude"],
  codex: ["codex"],
  opencode: ["opencode"],
  openclaw: ["openclaw"],
}
const INSTALLABLE_DEPENDENCIES = new Set(BASE_REMOTE_DEPENDENCIES)

function defaultStateRoot() {
  return process.env.OPENFLEET_CANONICAL_STATE_DIR || path.join(os.homedir(), ".openfleet")
}

function hostsFilePath(stateRoot = defaultStateRoot()) {
  return path.join(stateRoot, "hosts.json")
}

function defaultHostRegistry() {
  return { hosts: {} }
}

function loadHosts(filePath = hostsFilePath()) {
  const config = readJson(filePath)
  return {
    hosts: { ...(config?.hosts || {}) },
  }
}

function saveHosts(filePath = hostsFilePath(), registry = defaultHostRegistry()) {
  const next = {
    hosts: { ...(registry?.hosts || {}) },
  }
  writeJson(filePath, next)
  return next
}

function getHost(name, filePath = hostsFilePath()) {
  const host = loadHosts(filePath).hosts[name]
  if (!host) {
    throw new Error(`Unknown host: ${name}`)
  }
  return host
}

function upsertHost(name, input, filePath = hostsFilePath()) {
  const registry = loadHosts(filePath)
  const current = registry.hosts[name] || {}
  registry.hosts[name] = {
    ...current,
    ...input,
    installed: unique([...(current.installed || []), ...(input.installed || [])]),
    bootstrapped: Boolean(input.bootstrapped != null ? input.bootstrapped : current.bootstrapped),
  }
  saveHosts(filePath, registry)
  return registry.hosts[name]
}

function resolveSshKeyPath(sshKey) {
  if (!sshKey) return null
  if (sshKey === "~") return os.homedir()
  if (sshKey.startsWith("~/")) return path.join(os.homedir(), sshKey.slice(2))
  return sshKey
}

function buildSshTarget(host) {
  if (!host?.ip) {
    throw new Error("SSH host config requires an ip")
  }
  return host.user ? `${host.user}@${host.ip}` : host.ip
}

function buildSshArgs(host, remoteCommand, { timeout = 5000 } = {}) {
  const args = []
  const sshKey = resolveSshKeyPath(host?.ssh_key)
  if (sshKey) {
    args.push("-i", sshKey)
  }
  args.push("-o", "BatchMode=yes")
  args.push("-o", `ConnectTimeout=${Math.max(1, Math.ceil(timeout / 1000))}`)
  args.push(buildSshTarget(host))
  if (remoteCommand) {
    args.push(remoteCommand)
  }
  return args
}

function runSshCommand(host, remoteCommand, { exec = execFileSync, timeout = 5000, encoding = "utf8", stdio } = {}) {
  return exec("ssh", buildSshArgs(host, remoteCommand, { timeout }), {
    timeout,
    encoding,
    ...(stdio ? { stdio } : {}),
  })
}

function dependenciesForHarness(harness) {
  if (Array.isArray(harness)) {
    return unique(harness)
  }
  return unique([...BASE_REMOTE_DEPENDENCIES, ...(HARNESS_DEPENDENCIES[harness] || [])])
}

function buildDependencyCheckCommand(dependencies) {
  const deps = dependenciesForHarness(dependencies)
  return `for dep in ${deps.map(shellQuote).join(" ")}; do if command -v "$dep" >/dev/null 2>&1; then printf '%s\tinstalled\n' "$dep"; else printf '%s\tmissing\n' "$dep"; fi; done`
}

function checkRemoteDependencies(host, harness, options = {}) {
  const dependencies = dependenciesForHarness(harness)
  const output = runSshCommand(host, buildDependencyCheckCommand(dependencies), options)
  const status = parseDependencyCheckOutput(output)
  return {
    dependencies,
    installed: status.installed,
    missing: status.missing,
  }
}

function parseDependencyCheckOutput(output) {
  const installed = []
  const missing = []

  for (const line of String(output || "").split("\n")) {
    const [dependency, status] = line.trim().split("\t")
    if (!dependency || !status) continue
    if (status === "installed") installed.push(dependency)
    if (status === "missing") missing.push(dependency)
  }

  return { installed, missing }
}

function hashAgentPort(name) {
  return 14000 + Math.abs([...name].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 0) % 1000)
}

function buildHarnessLaunchCommand({ harness, model, workdir, name, token = null }) {
  const identityEnv = `OPENFLEET_AGENT_NAME=${shellQuote(name)} AGENT_NAME=${shellQuote(name)}`

  switch (harness) {
    case "claude-code": {
      const scriptPath = `/tmp/openfleet-launch-${name}.sh`
      const fs = require("fs")
      fs.writeFileSync(scriptPath, [
        `#!/bin/bash`,
        `export OPENFLEET_AGENT_NAME=${JSON.stringify(name)}`,
        `export AGENT_NAME=${JSON.stringify(name)}`,
        `exec claude --dangerously-skip-permissions --model ${model}`,
      ].join("\n"), { mode: 0o755 })
      return { command: scriptPath, opencodePort: null }
    }
    case "codex":
      return { command: `${identityEnv} codex -m ${model} -C ${shellQuote(workdir)} --full-auto`, opencodePort: null }
    case "opencode": {
      const opencodePort = hashAgentPort(name)
      // Serve-only launch script — bootstrap and attach happen after via API
      const scriptPath = `/tmp/openfleet-launch-${name}.sh`
      const fs = require("fs")
      fs.writeFileSync(scriptPath, [
        `#!/bin/bash`,
        `export OPENFLEET_AGENT_NAME=${JSON.stringify(name)}`,
        `export AGENT_NAME=${JSON.stringify(name)}`,
        `# Serve headless — spawn script handles bootstrap + attach`,
        `exec opencode serve --port ${opencodePort}`,
      ].join("\n"), { mode: 0o755 })
      return { command: scriptPath, opencodePort }
    }
    case "openclaw": {
      const openclawPort = hashAgentPort(name)
      return {
        command: `${identityEnv} ${buildOpenClawSpawnCommand(name, model, openclawPort, workdir, token)}`,
        openclawPort,
      }
    }
    default:
      throw new Error(`Unknown harness: ${harness}`)
  }
}

function resolveRemoteWorkdir(name) {
  if (!name) {
    throw new Error("Remote workdir requires an agent name")
  }
  return `${DEFAULT_REMOTE_ROOT}/${name}`
}

function buildRemoteTmuxSpawnCommand({ tmuxSession = DEFAULT_TMUX_SESSION, windowName, workdir, launchCommand }) {
  const target = `${tmuxSession}:${windowName}`
  return [
    buildRemoteMkdirCommand(workdir),
    `tmux has-session -t ${shellQuote(tmuxSession)} 2>/dev/null || tmux new-session -d -s ${shellQuote(tmuxSession)} -n bootstrap`,
    `tmux kill-window -t ${shellQuote(target)} 2>/dev/null || true`,
    `tmux new-window -t ${shellQuote(tmuxSession)} -n ${shellQuote(windowName)} -c ${shellQuote(workdir)} ${shellQuote(launchCommand)}`,
  ].join(" && ")
}

function buildRemoteMkdirCommand(workdir) {
  return `mkdir -p ${shellQuote(workdir)}`
}

function buildRemoteTmuxSendCommand({ tmuxSession = DEFAULT_TMUX_SESSION, windowName, message }) {
  const target = `${tmuxSession}:${windowName}`
  const encoded = Buffer.from(message, "utf8").toString("base64")
  return [
    `tmp=$(mktemp /tmp/openfleet-${sanitize(windowName)}-XXXXXX)`,
    `printf %s ${shellQuote(encoded)} | (base64 -d 2>/dev/null || base64 --decode) > "$tmp"`,
    `tmux load-buffer "$tmp"`,
    `tmux paste-buffer -t ${shellQuote(target)}`,
    `rm -f "$tmp"`,
    `tmux send-keys -t ${shellQuote(target)} Enter`,
  ].join(" && ")
}

function buildRemoteTmuxCaptureCommand({ tmuxSession = DEFAULT_TMUX_SESSION, windowName, lines = 40 }) {
  return `tmux capture-pane -pt ${shellQuote(`${tmuxSession}:${windowName}`)} -S -${Number(lines)}`
}

function buildRemoteTmuxHasSessionCommand({ tmuxSession = DEFAULT_TMUX_SESSION, windowName }) {
  return `tmux has-session -t ${shellQuote(windowName ? `${tmuxSession}:${windowName}` : tmuxSession)}`
}

function buildRsyncArgs(host, localDir, remoteDir) {
  const sshBits = ["ssh"]
  const sshKey = resolveSshKeyPath(host?.ssh_key)
  if (sshKey) {
    sshBits.push("-i", shellQuote(sshKey))
  }
  sshBits.push("-o", "BatchMode=yes")
  sshBits.push("-o", "ConnectTimeout=10")

  return [
    "-az",
    "--delete",
    "--exclude",
    ".git",
    "--exclude",
    "node_modules",
    "-e",
    sshBits.join(" "),
    ensureTrailingSlash(localDir),
    `${buildSshTarget(host)}:${shellQuote(ensureTrailingSlash(remoteDir))}`,
  ]
}

function rsyncDirectory(host, localDir, remoteDir, { exec = execFileSync, stdio = "ignore" } = {}) {
  return exec("rsync", buildRsyncArgs(host, localDir, remoteDir), { stdio })
}

async function ensureRemoteHost({ hostName, host, harness, hostsFile = hostsFilePath(), exec = execFileSync, confirm = confirmBootstrap }) {
  const dependencies = dependenciesForHarness(harness)
  const initial = checkRemoteDependencies(host, dependencies, { exec })
  if (!initial.missing.length) {
    upsertHost(hostName, { ...host, bootstrapped: true, installed: unique([...(host.installed || []), ...initial.installed]) }, hostsFile)
    return { ...initial, bootstrapped: false }
  }

  const installable = initial.missing.filter((dependency) => INSTALLABLE_DEPENDENCIES.has(dependency))
  const unsupported = initial.missing.filter((dependency) => !INSTALLABLE_DEPENDENCIES.has(dependency))

  if (!installable.length) {
    throw new Error(`Remote host ${hostName} is missing unsupported dependencies: ${unsupported.join(", ")}`)
  }

  const approved = await confirm({ hostName, installable, unsupported })
  if (!approved) {
    throw new Error(`Remote bootstrap declined for ${hostName}`)
  }

  const manager = detectPackageManager(host, { exec })
  if (!manager) {
    throw new Error(`Remote host ${hostName} is missing ${installable.join(", ")} but no supported package manager was detected`)
  }

  runSshCommand(host, buildInstallCommand(manager, installable), {
    exec,
    timeout: 300000,
    stdio: "inherit",
  })

  const final = checkRemoteDependencies(host, dependencies, { exec })
  if (final.missing.length) {
    throw new Error(`Remote host ${hostName} is still missing dependencies: ${final.missing.join(", ")}`)
  }

  upsertHost(hostName, {
    ...host,
    bootstrapped: true,
    installed: unique([...(host.installed || []), ...final.installed]),
  }, hostsFile)

  return { ...final, bootstrapped: true }
}

function detectPackageManager(host, { exec = execFileSync } = {}) {
  const output = runSshCommand(host, [
    "if command -v brew >/dev/null 2>&1; then printf brew;",
    "elif command -v apt-get >/dev/null 2>&1; then printf apt-get;",
    "elif command -v yum >/dev/null 2>&1; then printf yum;",
    "fi",
  ].join(" "), { exec })
  return String(output || "").trim() || null
}

function buildInstallCommand(manager, dependencies) {
  const packages = unique(dependencies.map((dependency) => mapPackageName(manager, dependency)).filter(Boolean))
  if (!packages.length) {
    throw new Error(`No installable packages for ${manager}`)
  }

  switch (manager) {
    case "brew":
      return `brew install ${packages.map(shellQuote).join(" ")}`
    case "apt-get":
      return `sudo apt-get update && sudo apt-get install -y ${packages.map(shellQuote).join(" ")}`
    case "yum":
      return `sudo yum install -y ${packages.map(shellQuote).join(" ")}`
    default:
      throw new Error(`Unsupported package manager: ${manager}`)
  }
}

function mapPackageName(manager, dependency) {
  if (dependency === "node") {
    if (manager === "brew") return "node"
    return "nodejs"
  }
  return dependency
}

async function confirmBootstrap({ hostName, installable, unsupported }) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(`Remote host ${hostName} requires approval to install: ${installable.join(", ")}`)
  }

  const extras = unsupported.length ? ` Remaining manual deps: ${unsupported.join(", ")}.` : ""
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = await rl.question(`Remote host ${hostName} is missing ${installable.join(", ")}.${extras} Install now? [y/N] `)
    return /^y(es)?$/i.test(answer.trim())
  } finally {
    rl.close()
  }
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)))
}

function sanitize(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]+/g, "-")
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}

module.exports = {
  BASE_REMOTE_DEPENDENCIES,
  buildDependencyCheckCommand,
  buildHarnessLaunchCommand,
  buildRemoteMkdirCommand,
  buildRemoteTmuxCaptureCommand,
  buildRemoteTmuxHasSessionCommand,
  buildRemoteTmuxSendCommand,
  buildRemoteTmuxSpawnCommand,
  buildRsyncArgs,
  buildSshArgs,
  buildSshTarget,
  checkRemoteDependencies,
  dependenciesForHarness,
  ensureRemoteHost,
  getHost,
  hashAgentPort,
  hostsFilePath,
  loadHosts,
  resolveRemoteWorkdir,
  rsyncDirectory,
  runSshCommand,
  saveHosts,
  upsertHost,
}
