# graphify

- **graphify** (`.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
  When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

## Workspace & Git Rules

- ALWAYS edit files directly in the primary repository root (`C:\Users\teo\Desktop\Ecanova` on the active branch).
- NEVER create or use git worktrees (`.claude/worktrees/*`) or `EnterWorktree` / `isolation: "worktree"` for any task or subagent unless explicitly requested by the user.
