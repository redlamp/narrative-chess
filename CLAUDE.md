# Narrative Chess V2

## Memory Management

This project keeps a local memory tree at `.claude/memory/`.

### Structure

- `memory.md` — index of all project memory files, updated whenever you create or modify one
- `general.md` — project conventions, preferences, environment setup
- `domain/{topic}.md` — domain-specific knowledge (one file per topic)
- `tools/{tool}.md` — tool configs, CLI patterns, workarounds

### Rules

1. When you learn something worth remembering, write it to the right file immediately
2. Keep `memory.md` as a current index with one-line descriptions
3. Entries: date, what, why — nothing more
4. Read `.claude/memory/memory.md` at session start. Load other files only when relevant
5. If a file doesn't exist yet, create it
6. Before removing or modifying any existing memory entry, use `AskUserQuestion` to confirm
   with the user — show the current content and the proposed change

### Maintenance

When the user says "reorganize memory":
1. Read all memory files
2. Remove duplicates and outdated entries
3. Merge entries that belong together
4. Split files that cover too many topics
5. Re-sort entries by date within each file
6. Update `memory.md` index
7. Show a summary of what changed

## Global Memory

Cross-project memory lives at `~/.claude/memory/` (see `~/.claude/CLAUDE.md`).

At session start, read **both** in order:
1. `~/.claude/memory/memory.md` — cross-project index
2. `.claude/memory/memory.md` — this project's index

Project memory takes precedence on conflict; promote anything reusable to global.

## Domain Knowledge Lifecycle

1. Staging — knowledge accumulates in `.claude/memory/domain/{name}/`
2. Promotion — enough knowledge exists to package as a plugin/skill
3. Pointer — after promotion, the memory file becomes a pointer to the plugin;
   content lives in the plugin

When an update is needed to a promoted domain, note it in the memory file so an issue
can be created on the plugin repo.

## Wiki

Project knowledge graph lives in `wiki/` (Obsidian vault). See `wiki/CLAUDE.md` for
folder layout, naming, linking, and write-policy conventions.

Three-way split:
- `.claude/memory/` — machine-curated, AI auto-context (preferences, conventions, identity)
- `wiki/` — human-readable knowledge graph (decisions, research, people, projects, daily logs)
- `docs/` — formal artefacts (PRDs, specs, public docs)

When unsure where a piece of info belongs: half-formed thoughts → `wiki/`; AI-context facts
→ `.claude/memory/`; formal/public docs → `docs/`.
