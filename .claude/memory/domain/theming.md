# Theming Discipline

**Date:** 2026-05-02

## Decisions

- **Style:** New York (shadcn preset, picked at init)
- **Base color:** Slate (CSS vars resolve to slate-derived oklch values in `app/globals.css`)
- **CSS variables:** enabled — components reference `bg-background`, `text-foreground`, etc., never hardcoded colors

## Multi-theme intent

User wants to support multiple themes in future. Therefore:

- **Never hardcode color classes** in components (no `bg-blue-500`, `text-zinc-900`, etc.)
- Always use semantic Tailwind classes that resolve to CSS vars: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `bg-destructive`, etc.
- Defining new themes happens in `app/globals.css` via `[data-theme="x"] { --background: ...; }` overrides on the var palette
- Theme switching = swap `data-theme` attribute on `<html>`, components untouched
- When ready: install `next-themes` for theme toggle UI

## Why

- Components stay theme-agnostic — one component, N themes
- CSS-var palette is the single source of truth
- No regression hunt across components when adding a theme

## See also

- `app/globals.css` — `@theme inline` block defines current palette
- `wiki/notes/decision-stack-nextjs-16.md` — stack decisions
- shadcn theming docs: https://ui.shadcn.com/docs/theming
