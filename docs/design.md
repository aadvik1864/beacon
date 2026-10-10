# Design direction

## Concept

A security experiment workbench, not a landing page or generic KPI dashboard.
One shared model/tool path divides into two role-specific access boundaries.
The split is the memorable visual device; everything else stays quiet.

## Tokens

| Token | Value | Role |
| --- | --- | --- |
| Workspace | #F3F6F8 | Page canvas |
| Surface | #FFFFFF | Working panels |
| Ink | #152536 | Main text and diagram |
| Signal | #2458D3 | Focus, selected controls |
| Allowed | #137665 | Allowed permission descriptions |
| Denied | #B42332 | Restricted permission descriptions |

IBM Plex Sans carries interface text. IBM Plex Mono is reserved for actual code,
object keys, tool calls, and setup commands. Both fonts are served locally.

## Layout

Left-aligned, compact navigation; a wide shared architecture strip; unequal
columns for document context and paired permission boundaries. No marketing
hero, fabricated metrics, or grid of identical stat cards. Mobile collapses the
columns in reading order and retains visible navigation.

## Interaction and motion

Motion answers a user action: navigating the setup guide, selecting a component,
or explicitly changing a component's preview state. No looping background or
continuous animation on the workbench. Reduced motion is supported at system
level and through an interface preference. Core text stays static and readable.

## Beacon experiment surface

The editor is the preparation space; the paired results are the inspection space.
The split permission boundary remains the visual anchor, not a generic dashboard
of counts. The light steel-blue palette and Plex typography are retained through
the Beacon rename. A radio-tower mark identifies the app without replacing the
security vocabulary of its permission controls.

```text
Document draft + question | Captured vulnerable / protected results
                  Replay-synchronized access path
                  Filtered events | Selected evidence
```

Results display local provenance before conclusions. A changed draft cannot
silently relabel a capture. On narrow screens the result lanes stack in reading
order. Graph nodes are selectable/draggable, with keyboard controls and a text
alternative; moving a node changes layout only. No edge editing changes access.
Replay advances only after an explicit Play action and never performs tool calls.

## Review before implementation

The initial SaaS-card/terminal direction was rejected: it obscured the actual
security boundary. The revised design uses a shared-to-split architecture,
plain-language permission labels, and persistent provenance indicators. The
React Bits source is adapted to that direction, not displayed with its default
purple/black demo palette.
