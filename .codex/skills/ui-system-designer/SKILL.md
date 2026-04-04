---
name: ui-system-designer
description: Design ANN Studio product screens and reusable UI patterns aligned with Braize visual direction and dashboard-first SaaS UX.
license: MIT
---

Use this skill to define screen structure, component hierarchy, and visual consistency across ANN Studio modules.

When this skill should trigger:
- User requests a new feature screen or major UX flow.
- Existing UI needs consistency and reusable patterns.
- A workflow must be made product-grade for daily operations and demos.

When this skill should NOT trigger:
- Pure backend/domain contract tasks.
- Small one-line style fixes.
- Non-UI algorithm changes.

Workflow:
1. Read docs/ui/design-brief.md before proposing UI.
2. Define user journey and step sequence.
3. Define reusable UI blocks (cards, section headers, tables, modals, pickers, forms, status chips).
4. Specify information hierarchy for fast operational scanning.
5. Define states explicitly:
- empty
- loading
- success
- validation error
- system failure
6. Keep dependencies minimal and prefer local CSS + existing shared components.
7. Ensure responsive behavior for desktop and mobile.

Mandatory ANN Studio checks:
- Keep left-sidebar navigation pattern.
- Preserve corporate, modern, Braize-aligned visual language.
- Avoid toy-like utility layouts and generic starter templates.
- Keep feature UI logic separate from low-level services.

Output format:
- Screen goals
- User flow
- Component structure
- State matrix
- Styling and interaction notes
- Reuse plan for shared components

Definition of good:
- Looks like a coherent part of ANN Studio.
- Information hierarchy is obvious.
- Reusable patterns reduce duplicated UI code.
