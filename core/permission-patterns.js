const DEFAULT_APPROVE_SEQUENCE = ["Enter"]
const DEFAULT_DENY_SEQUENCE = ["Down", "Down", "Enter"]

const PERMISSION_PATTERNS = [
  {
    id: "opencode",
    label: "permission",
    matchers: [/Permission required/i, /Allow once/i],
    approveSequence: ["Right", "Enter", "Enter"],
    denySequence: ["Right", "Right", "Enter"],
  },
  {
    id: "claude-code",
    label: "permission",
    matchers: [/Do you want to allow/i, /(?:\by\/n\b|Yes, allow once)/i],
    approveSequence: DEFAULT_APPROVE_SEQUENCE,
    denySequence: DEFAULT_DENY_SEQUENCE,
  },
  {
    id: "codex",
    label: "permission",
    matchers: [/Do you trust/i, /trust options/i],
    approveSequence: DEFAULT_APPROVE_SEQUENCE,
    denySequence: DEFAULT_DENY_SEQUENCE,
  },
  {
    id: "generic",
    label: "permission",
    matchers: [/permission/i, /(allow|deny|reject)/i],
    approveSequence: DEFAULT_APPROVE_SEQUENCE,
    denySequence: DEFAULT_DENY_SEQUENCE,
  },
]

module.exports = {
  DEFAULT_APPROVE_SEQUENCE,
  DEFAULT_DENY_SEQUENCE,
  PERMISSION_PATTERNS,
}
