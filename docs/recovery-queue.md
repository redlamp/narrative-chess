# Recovery Queue - 2026-04-05

This queue tracks the user prompts that were interrupted by usage-limit failures and the state of the recovery work after the latest integration pass.

## Recovered In This Pass

### 1. Editor UX cleanup
Status:
- completed, except for adding London as a second sample city

Goal:
- make the content editors feel consistent and easier to scan

Recovered:
- `Add role` now lives in the `[type] roles` panel
- role detail supports remove and reset actions
- traits and verbs now use inline tag-style editing
- Roles, Cities, and Classics now use clearable search controls
- Cities now has sorting, a simplified city list row, and a sticky detail editor
- full-page scrolling is preferred more consistently across the editor surfaces

Still open:
- add London as a second sample city record
- continue broad multi-city authoring once the London sample exists

Why this is a slice:
- these changes all move the app toward one readable list/detail editing pattern without changing core gameplay

### 2. Match style and assets
Status:
- completed

Goal:
- give the app a clean way to review piece styling, piece art, and CSS references

Recovered:
- the light/dark toggle is now icon-only and shows the target mode
- Research now includes `competition`, `Art assets`, and `style reference` tabs
- the app includes piece asset and styling reference pages
- piece CSS can be edited live, shared with the app, and saved to a repo-local file

Why this is a slice:
- the user wants a controlled styling reference surface, not a redesign of core chess logic

### 3. Layout and settings recovery
Status:
- completed

Goal:
- make local layout behavior easier to reset and more predictable

Recovered:
- named layout files can now be removed
- deleting a named layout returns the workspace to the default layout state

Why this is a slice:
- layout persistence is already in place, so this is a small but useful management pass

### 4. Research page organization
Status:
- completed

Goal:
- separate research content by purpose instead of keeping it in one undifferentiated list

Recovered:
- the Research surface now uses tabs for `competition`, `Art assets`, and `style reference`

Why this is a slice:
- the research page is already present, so this is mostly an information architecture cleanup

### 5. Docs follow-up
Status:
- completed

Goal:
- keep the PRD and usage guidance in sync with the product direction

Recovered:
- PRD gap review is documented
- a revised PRD draft is in place
- user suggestions for agent roles and prompt efficiency are documented

Why this is a slice:
- the docs should keep the next implementation steps obvious when usage limits interrupt a run

## Remaining Recovery Follow-Up

### 1. Add London as a sample city
Goal:
- prove the Cities workspace can support more than one city with a real second sample

Why it still matters:
- it is the one explicit missed prompt from this batch that did not land yet
- it validates the multi-city editing pattern more convincingly than Edinburgh alone

### 2. Broader design cleanup
Goal:
- continue the earlier design-review request with a focused pass on Match and any remaining nested-scroll friction

Why it still matters:
- the editor pages are improved, but the broader app shell still needs a more deliberate chess-first hierarchy

### 3. Accessibility follow-through
Goal:
- continue the existing keyboard/semantics pass after the recovery features settle

Why it still matters:
- the recovery work added more controls and surfaces, so the next pass should keep accessibility debt from accumulating
