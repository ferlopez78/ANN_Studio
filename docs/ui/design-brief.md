# ANN_Studio UI Design Brief

## Product
ANN_Studio

## Brand Relationship
ANN_Studio is a product by Braize.
The UI should inherit the visual identity and professional tone of Braize, but it must feel like a real software product, not a marketing website.

## Visual Direction
The product must feel:
- modern
- technological
- corporate
- executive
- data-oriented

## Core UX Principles
- clear hierarchy
- clean layouts
- generous spacing
- easy scan of metrics and status
- dashboards first
- professional SaaS feel
- minimal visual noise

## Navigation
Use a left sidebar as the primary navigation pattern.

Main sections:
- Dashboard
- Projects
- Datasets
- Model Design
- Runs
- Live Metrics
- Model Registry
- Settings

## Theme
- light theme by default
- dark mode supported later
- both themes should feel aligned with Braize identity

## Color Direction
Use Braize-inspired colors:
- blue
- light blue / cyan
- silver / neutral gray
- black
- white

Avoid:
- strong green as primary brand color
- overly saturated colors
- flashy gradients
- gaming/futuristic neon look

## Typography
Typography should feel modern, clean, corporate, and highly legible.
Prefer strong hierarchy and restrained styling over decorative effects.

## Layout Style
- executive and airy
- rounded modern cards
- clean panels
- elegant tables
- clear KPI blocks
- balanced whitespace
- subtle borders and shadows

## Dashboard Expectations
The dashboard should prioritize:
1. project overview
2. run status
3. datasets summary
4. model registry summary
5. alerts and quick actions

The dashboard must feel like an operational control center for ML work.

## What Good Looks Like
A good screen should look like:
- a serious SaaS product
- a platform for technical and business users
- clean enough for leadership demos
- practical enough for daily ML operations

## What To Avoid
Avoid:
- toy-like UI
- default starter layouts
- overly generic admin templates
- dense blocks with little spacing
- too many colors
- giant hero sections
- marketing-style landing page patterns
- fake futuristic visuals

## Implementation Constraints
- keep dependencies minimal
- prefer CSS and React structure over heavy UI libraries
- do not introduce large design systems unless explicitly approved
- prioritize reusable layout structure and visual consistency

## Reference Usage
Use the screenshots under `docs/ui/references/` as visual context.
Use Braize as the main design reference.
If another reference conflicts with Braize, prefer Braize.

## Definition of Done for UI Iterations
A UI iteration is good enough when:
- it looks clearly better than a starter template
- it feels aligned with Braize
- it looks like a professional product
- the information hierarchy is clear
- the layout is clean and credible