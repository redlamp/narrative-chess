# Narrative Chess V2 - Memory Index

Read this file at session start. Load specific topic files only when relevant.

| File | Description | Last updated |
|------|-------------|--------------|
| `general.md` | Project conventions, workflow preferences, workspace pointers | 2026-05-02 |
| `domain/theming.md` | shadcn New York + Slate, CSS-var-only theming for multi-theme future | 2026-05-02 |
| `domain/auth.md` | Auth state — email+password, **email confirmation OFF**, must re-enable before broader release | 2026-05-02 |

## Cross-Memory Sync Rule

At session start, after reading this file:
1. Note the Last updated dates in the table above
2. If an entry contains a fact that would apply across projects (tool gotcha, OS workaround, language quirk), promote it to `~/.claude/memory/tools/` or `~/.claude/memory/domain/`
3. Update the Last updated date on this file after any changes

## Domain Knowledge Lifecycle

1. Staging — knowledge accumulates in `domain/{name}/`
2. Promotion — enough knowledge exists to package as a plugin/skill
3. Pointer — after promotion, the memory file becomes a pointer to the plugin
