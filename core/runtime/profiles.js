const fs = require("fs")
const path = require("path")

function profilesPath(stateDir) {
  return path.join(stateDir, "profiles.json")
}

function defaultProfiles() {
  return {
    profiles: {},
  }
}

function loadProfiles(stateDir) {
  try {
    return JSON.parse(fs.readFileSync(profilesPath(stateDir), "utf8"))
  } catch {
    return defaultProfiles()
  }
}

function saveProfiles(stateDir, data) {
  fs.mkdirSync(stateDir, { recursive: true })
  fs.writeFileSync(profilesPath(stateDir), `${JSON.stringify(data, null, 2)}\n`)
}

function upsertProfile(stateDir, input) {
  if (!input?.profile_id && !input?.profileId && !input?.id) {
    throw new Error("profile requires profile_id")
  }

  const profileId = input.profile_id || input.profileId || input.id
  const data = loadProfiles(stateDir)
  const current = data.profiles[profileId] || {}
  const next = {
    ...current,
    ...input,
    profile_id: profileId,
    updated_at: new Date().toISOString(),
  }
  data.profiles[profileId] = next
  saveProfiles(stateDir, data)
  return next
}

function getProfile(stateDir, profileId) {
  return loadProfiles(stateDir).profiles[profileId] || null
}

function listProfiles(stateDir) {
  return Object.values(loadProfiles(stateDir).profiles).sort((a, b) => {
    const au = a.updated_at || ""
    const bu = b.updated_at || ""
    return au < bu ? 1 : -1
  })
}

function isRateLimited(profile, now = new Date()) {
  if (!profile) return false
  if (profile.status !== "rate_limited") return false
  if (!profile.cool_down_until) return true
  const until = new Date(profile.cool_down_until)
  return Number.isNaN(until.getTime()) ? true : until > now
}

function isAvailable(profile, now = new Date()) {
  if (!profile) return false
  if (profile.status === "hard_failed") return false
  if (isRateLimited(profile, now)) return false
  return (profile.status || "available") !== "disabled"
}

function selectProfile(stateDir, { allowed = [], preferred = null, role = null, harness = null } = {}) {
  const profiles = listProfiles(stateDir)
  let candidates = profiles

  if (allowed.length) {
    const allowedSet = new Set(allowed)
    candidates = candidates.filter((profile) => allowedSet.has(profile.profile_id))
  }

  if (role) {
    candidates = candidates.filter((profile) => profile.role === role || !profile.role)
  }

  if (harness) {
    candidates = candidates.filter((profile) => profile.harness === harness)
  }

  candidates = candidates.filter((profile) => isAvailable(profile))

  if (preferred) {
    const preferredMatch = candidates.find((profile) => profile.profile_id === preferred)
    if (preferredMatch) return preferredMatch
  }

  return candidates[0] || null
}

module.exports = {
  getProfile,
  isAvailable,
  isRateLimited,
  listProfiles,
  loadProfiles,
  profilesPath,
  saveProfiles,
  selectProfile,
  upsertProfile,
}
