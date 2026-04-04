---
name: git-commit
description: Stage intended changes, write accurate commit messages, and push safely.
---

# Git Commit

Use this skill when the user wants a clean commit, branch push, or both.

1. Start with `git status --short` to see tracked and untracked changes.
2. Inspect `git diff` and `git diff --cached` so the commit matches the actual work.
3. Read recent `git log --oneline -5` entries to mirror the repository's message style.
4. Stage only the files that belong to the requested change.
5. Do not stage secrets, local config, or unrelated worktree noise.
6. If the worktree is dirty with unrelated edits, leave them alone and commit only the relevant subset.
7. Write a commit message that captures why the change exists, not just the filenames touched.
8. Prefer a short imperative subject such as `fix auth retry loop` or `add fleet status skill docs`.
9. Add a body only when the intent or tradeoff needs context.

Before committing:

- Run the smallest relevant verification step if the change affects behavior.
- Confirm generated files are intentional.
- Re-read the staged diff one last time.

When pushing:

- Check the current branch and upstream first.
- Use a normal push or `git push -u origin <branch>` for new branches.
- Never force push unless the user explicitly requests it.
- Never amend a pushed commit unless the user explicitly requests that exact operation.

Report the result with branch name, commit hash, and whether the push succeeded.

If the commit fails because of hooks, surface the hook output and fix the underlying problem instead of bypassing it.
