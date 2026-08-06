---
name: new-component
description: Generate a new Mantine UI component following project patterns (TypeScript)
disable-model-invocation: true # User-only
---

# New Component Generator

Creates a new Mantine component with proper typing and theme usage.

## Usage

/new-component [ComponentName] [type]

Types: card | form | modal | layout

Example: /new-component ReviewCard card

## Implementation

Creates `app/src/components/{ComponentName}.tsx`:

- Import Mantine components
- TypeScript interface for props
- Take colours and spacing from the theme (`app/src/theme.ts`) or Mantine props —
  never hardcode hex values
- Must render on the server: no `window`/`document`/`localStorage` outside effects
- Export component with proper typing
- Add basic JSDoc
