---
tags:
  - domain/stack
  - status/adopted
  - scope/foundation
---

# Decision — Theming: shadcn New York + Slate, CSS-Var-Only

**Date:** 2026-05-02
**Status:** Adopted

## Context

shadcn/ui init prompts for style preset + base color + CSS-vars-or-Tailwind-classes. Choice locks in component output for the project. Future intent: support multiple themes (light, dark, custom palettes).

## Choice

- **Style:** New York (shadcn preset, picked at init)
- **Base color:** Slate (CSS vars resolve to slate-derived oklch values in `app/globals.css`)
- **CSS variables:** enabled — components reference `bg-background`, `text-foreground`, etc., never hardcoded colors

## Discipline (multi-theme intent)

- **Never hardcode color classes** in components (no `bg-blue-500`, `text-zinc-900`, etc.)
- Always use semantic Tailwind classes resolving to CSS vars: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `bg-destructive`, etc.
- Defining new themes happens in `app/globals.css` via `[data-theme="x"] { --background: ...; }` overrides on the var palette
- Theme switching = swap `data-theme` attribute on `<html>`, components untouched
- Theme toggle UI ships in M1.5+ via `next-themes` + Sun/Moon button in SiteHeader (PR #21)

## Why

- Components stay theme-agnostic — one component, N themes
- CSS-var palette is single source of truth
- No regression hunt across components when adding a theme

## See also

- `app/globals.css` — `@theme inline` block defines current palette
- [[decision-stack-nextjs-16]] — broader stack decisions
- shadcn theming docs: https://ui.shadcn.com/docs/theming
- [[mocs/decisions]]
