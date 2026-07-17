---
name: tailwind-best-practices
description: Tailwind CSS styling guidelines for Gifvtme's Next.js app. Use when writing, reviewing, or refactoring styling code in app/, components/, or shared UI primitives to preserve Gifvtme's design system, component library, and Tailwind v4 token usage. Triggers on tasks involving Tailwind classes, component styling, className overrides, responsive layout, or design tokens.
---

# Tailwind Best Practices

## Overview

Routing and priority guide for Gifvtme app styling, containing 5 rules across 3 categories. Rule files hold the detailed explanations, examples, and review guidance that ensure design system consistency, prevent token drift, and maintain component library integrity.

## Scope

- `app/`
- `components/`
- `context/design/`

## When to Apply

Reference these guidelines when:

- Writing new React components with Tailwind styles
- Reviewing code for styling consistency
- Refactoring existing styled components
- Adding or modifying UI elements

## Priority-Ordered Guidelines

Rules are prioritized by impact:

| Priority | Category        | Impact   |
| -------- | --------------- | -------- |
| 1        | Component Usage | CRITICAL |
| 2        | Design Tokens   | CRITICAL |
| 3        | ClassName Usage | HIGH     |

## Quick Reference

### Critical Patterns (Apply First)

**Component Usage:**

- Use existing primitives from `components/ui/` and domain components from `components/<domain>/` (`component-use-existing`)
- Never duplicate a component that belongs in the shared component library

**Design Tokens:**

- Use Gifvtme's `@theme` CSS tokens in `app/globals.css`, documented by `context/design/DESIGN_SYSTEM.md` (`tokens-use-existing`)
- Do not modify the `@theme` CSS token definitions without explicit approval and matching design-system docs updates (`tokens-no-modification`)

### High-Impact Patterns

**ClassName Usage:**

- No arbitrary Tailwind values except `height` and `width` (`classname-no-arbitrary`)
- Use component variants/props before overriding shared primitive styles with `className` (`classname-no-ds-override`)

## References

Rule files are the canonical source for detailed guidance and examples:

- `references/tailwind-best-practices-reference.md` - Rule catalog with category order and rule-file paths
- `references/rules/` - Canonical individual rule files organized by category

Load only the relevant rule file when implementing or reviewing a specific styling rule. Use the catalog to choose the right rule without loading every example.

To look up a specific pattern, grep the rules directory:

```
grep -l "component" references/rules/
grep -l "token" references/rules/
grep -l "className" references/rules/
```

## Rule Categories in `references/rules/`

- `component-*` - Component usage rules (1 rule)
- `tokens-*` - Design token rules (2 rules)
- `classname-*` - ClassName usage rules (2 rules)
