# Narrative Chess PRD v2 Draft

This is a compact revision draft based on the current repo state and the recovery queue.

## What To Keep

- Chess clarity and correctness stay first.
- The 2D board remains the primary play surface.
- Narrative support stays lightweight and explainable.
- City-context and style research should remain editor-reviewed, not procedurally generated.

## What The Current Prototype Suggests

- The app benefits from shared editor shells for Cities, Roles, Classics, and research pages.
- Match mode needs to feel more board-first and less dashboard-like.
- Layout editing is useful, but it should remain a power-user tool rather than the default emphasis.
- CSS and asset references are worth making editable because they help future visual passes stay grounded.

## Recommended Adjustments

1. Make Match the default landing experience and keep other pages secondary.
2. Keep Cities, Roles, Classics, and Research on a consistent list/detail editor pattern.
3. Preserve live local editing, but keep file-backed save/load simple and explicit.
4. Treat style references as inspectable project content, not a hidden theme system.
5. Continue to avoid 3D, multiplayer, and large simulation systems until the current shell feels stable.

## Known Deviations To Watch

- The research area is growing into multiple subpages, so it needs to stay clearly separated from the match shell.
- Layout editing can create visual noise if it becomes too prominent.
- The style editor should remain a practical reference tool, not a design system in disguise.

## Next Review Questions

- Should Match collapse into a narrower board/move/inspector layout by default?
- Should city, role, and classics editors all converge on one reusable shell component?
- Which style states need to be first-class before the next visual pass?
- Which saved files should be promoted from local drafts to checked-in project assets?
