# Design direction

## Concept

A security experiment workbench, not a landing page or generic KPI dashboard.
One shared model/tool path divides into two role-specific access boundaries.
The split is the memorable visual device; everything else stays quiet.

## Tokens

| Token | Value | Role |
| --- | --- | --- |
| Workspace | #EEF3F8 | Page canvas |
| Surface | #FFFFFF | Working panels |
| Ink | #152536 | Main text and diagram |
| Preview | #18324F | Local permission illustration |
| Signal | #2458D3 | Focus, selected controls |
| Allowed | #137665 | Allowed permission descriptions |
| Denied | #B42332 | Restricted permission descriptions |

IBM Plex Sans carries interface text. IBM Plex Mono is reserved for actual code,
object keys, tool calls, and setup commands. Both fonts are served locally.

## Layout

Compact horizontal navigation; a document editor beside paired results. Settings
and developer tools live in the More menu. Mobile uses a small navigation drawer
and stacks the editor and results in reading order.

## Interaction and motion

Motion answers a user action: switching a document/template, moving the pointer
or keyboard focus, running a comparison, or navigating the setup guide. React
Bits RubberSegment stretches a selector's leading/trailing edges. SpotlightCard
tracks local pointer/focus position without a global listener or drawing loop.
ClickSpark draws a short, bounded burst when the run button is activated and
stops when it is finished. Captured results reveal once after execution/import.
No looping background or continuous idle animation is used. System and explicit
reduced-motion preferences are respected, including preference changes.

## Beacon experiment surface

The editor is the preparation space; the paired results are the inspection space.
The split permission boundary remains the visual anchor, not a generic dashboard
of counts. The light steel-blue palette and Plex typography are retained through
the Beacon rename. A radio-tower mark identifies the app without replacing the
security vocabulary of its permission controls.

```text
Beacon   Playground   Architecture                          More

Document + question          Permission preview before a run
                             Vulnerable / protected answers after a run
Options (closed)             Access details (closed)
Run comparison               Export / Run info

Inspect run (closed)
  Events | Access path
```

One short notice identifies the scripted simulation, synthetic data, and absence
of AWS calls. Imported captures retain a visible unverified-authenticity label.
A changed draft cannot silently relabel a capture.

Results show the outcome and answer first. Measurements, tool feedback, and
explanations are behind Access details. Before a run there is one empty state,
not duplicate empty cards or empty graphs. Options, exports, run metadata, and
inspection tools use progressive disclosure. Replay remains user initiated.

Graph nodes are selectable/draggable, with keyboard controls and a text
alternative. Moving a node changes layout only. Inspection tabs preserve graph
layout and event filters while open; closing inspection pauses replay.

## Review before implementation

The first workbench became too dense: a sidebar, repeated mode banners, large
slogans, duplicated permission rows, and permanently expanded evidence panels.
The revised screen keeps the split result comparison but removes the competing
chrome. Headings name the page or task. UI copy uses plain punctuation, no long
dashes or decorative taglines. The existing palette and local Plex fonts remain;
body text is larger rather than using tiny type to fit more labels.

## Interactive polish

The visual emphasis is a navy permission preview, not a decorative hero or an
always-moving background. Selecting policy/payroll changes the allowed paths
and the accompanying plain-language scope description. No requests or captures
are created by the preview. It disappears when actual local results are present.

The larger heading, softer canvas, document surface, and role icons make the
workbench easier to scan. The editor and actual answers remain white, with color
reserved for selection, access, and outcomes. Native button activation and scoped
arrow/Home/End navigation keep the new controls usable without a pointer. Custom
documents do not falsely select a built-in template. Settings and evidence remain
collapsed so the added interaction does not bring back the earlier clutter.
