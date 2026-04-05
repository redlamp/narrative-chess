# User Suggestions

This file captures a few practical ways to keep the project moving without burning tokens or branching too wide.

## Helpful Agent Roles

- `implementation agent`: takes one bounded slice and commits it.
- `review agent`: checks design, accessibility, or PRD drift after a slice lands.
- `docs agent`: keeps the queue, PRD notes, and user-facing guidance current.
- `research agent`: gathers references, examples, and source links without editing code.

## Prompt Efficiency

- Bundle closely related asks into one slice, but keep unrelated surfaces separate.
- Name the target files and the ownership boundary up front.
- Say what must not change, especially shared schemas and unrelated pages.
- Ask for a branch and commit in the same message when you want the work to persist.
- Prefer “make X and Y share a pattern” over separate one-off feature requests.

## Recovery Workflow

- If a task fails because of usage limits, rebuild the queue from the prompt log before continuing.
- Keep a small recovery branch per slice so the work can be merged cleanly.
- Verify each merged slice with `lint`, `typecheck`, `test`, and `build` before moving on.
- Record any open deviations from the PRD in a doc so the next pass is obvious.

## Branching Guidance

- Use one branch per slice.
- Commit the smallest coherent change that can stand on its own.
- Merge only after the slice is verified.
- Leave a clear note when a prompt is only partially satisfied.
