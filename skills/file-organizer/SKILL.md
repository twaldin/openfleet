---
name: file-organizer
description: Reorganize files safely, update references, and leave the project easier to navigate.
---

# File Organizer

Use this skill when renaming files, moving directories, or cleaning up project structure.

1. Inventory the current layout before moving anything.
2. Group files by runtime boundary, feature area, or ownership instead of arbitrary folder names.
3. Prefer the smallest structural change that solves the navigation problem.
4. Rename for clarity and consistency, especially when file names no longer match their contents.
5. Keep public entry points stable unless the user asks for a breaking reorganization.
6. Update every import, require, path reference, script, and doc link affected by the move.
7. Search for string references after a rename so hidden paths do not break later.
8. Avoid mixing a broad refactor with unrelated code cleanup.
9. Preserve history-friendly moves where possible instead of delete-and-recreate churn.

Safe workflow:

- Decide the target structure first.
- Move one logical group at a time.
- Update references immediately after each move.
- Run the relevant build, tests, or typecheck after structural edits.

Watch for hidden dependencies:

- CI paths
- Docker copy paths
- Import aliases
- Generated code outputs
- Documentation examples

Report the old-to-new mapping clearly when the change spans multiple files or directories.
