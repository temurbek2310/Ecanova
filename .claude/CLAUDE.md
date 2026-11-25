# graphify

- **graphify** (`.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
  When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

## Workspace & Git Rules

- ALWAYS edit files directly in the primary repository root (`C:\Users\teo\Desktop\Ecanova` on the active branch).
- NEVER create or use git worktrees (`.claude/worktrees/*`) or `EnterWorktree` / `isolation: "worktree"` for any task or subagent unless explicitly requested by the user.

## ECONOVA UI & Architecture Rules

- Learner cards use Glass Brutalism (`bg-white/25 dark:bg-[#101522]/25 backdrop-blur-2xl border-2`). Never add `isolate`, `will-change-transform`, or resting `transform`/`opacity < 1` on card ancestors (breaks WebGL `backdrop-filter`).
- Render overlays/modals in top-level `fixed` layers outside `<main>`.
- Do not touch `/admin` (`.admin-*`) or live Supabase migrations unless explicitly asked.
- Always verify with `npx tsc --noEmit && npm test && npm run build`.
