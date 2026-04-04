# Skills

## Overview

OpenFleet uses repo-native `SKILL.md` files as the shared skill format across harnesses. A skill is just a directory with one markdown file plus required frontmatter.

Directory layout:

```text
skills/
  health-check/
    SKILL.md
  discord-post/
    SKILL.md
```

## File Format

Each skill must have frontmatter with `name` and `description`.

```md
---
name: health-check
description: Verify service health before and after changes.
---

# Health Check

Use this skill when you need a quick operational verification pass.

1. Identify the relevant health signal.
2. Check the current status before making changes.
3. Re-run the same checks after the change.
4. Report failures with the exact failing command or signal.
```

If the frontmatter is missing, skill loading fails.

## Attach Skills To Agents

Skills are attached in `agents.json`.

```json
{
  "agents": {
    "coder": {
      "name": "coder",
      "role": "persistent",
      "harness": "opencode",
      "model": "gpt-5.4",
      "skills": ["health-check", "discord-post"]
    }
  }
}
```

When that agent is spawned or respawned, OpenFleet projects the skill files into the harness workspace.

## Native Projection Paths

| Harness | Skill Path |
| --- | --- |
| `claude-code` | `.claude/skills/<name>/SKILL.md` |
| `opencode` | `.opencode/skills/<name>/SKILL.md` |
| `openclaw` | `skills/<name>/SKILL.md` |
| `codex` | `.agents/skills/<name>/SKILL.md` |

For harnesses without native skill discovery, OpenFleet falls back to an instruction file and appends an `# Available Skills` index.

## Writing Good Skills

- Keep the title and description operational.
- Put the behavior in the markdown body, not in the frontmatter.
- Prefer short numbered steps over long prose.
- Write skills to be reusable across models and harnesses.
- Avoid harness-specific commands unless the skill is intentionally harness-specific.

## Sharing Skills Across Harnesses

This is the main design goal:

- one source file in `skills/`
- projected into harness-native discovery paths when supported
- indexed in instructions when native discovery is not available

That means the same `health-check` skill can be consumed by Claude Code, OpenCode, OpenClaw, Codex, or a future harness.

## Example Workflow

1. Add `skills/health-check/SKILL.md`
2. Attach `"health-check"` to an agent in `agents.json`
3. Spawn the agent with `openfleet spawn ...`
4. OpenFleet copies the skill into the harness workspace

Example:

```bash
openfleet spawn evaluator --harness opencode --model gpt-5.4 --dir ~/src/my-repo
```

## Validation Tips

- Check that the skill name matches the directory name.
- Check that the frontmatter has both required keys.
- Re-spawn the agent after changing skills.
- If a skill is missing, OpenFleet warns and continues projecting the remaining skills.

## Recommended Conventions

- Use kebab-case names like `health-check`
- Keep descriptions to one sentence
- Prefer generic task language over vendor-specific wording
- Commit skills with the code that depends on them
