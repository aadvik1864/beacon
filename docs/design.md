# Design direction

## Purpose

Beacon is a hands-on security lab for learning why assistants need limited file
access. A visitor can add a misleading instruction to a fictional leave policy,
ask a normal question, and compare what two access configurations allow.
The assistant is scripted; neither live model inference nor AWS is enabled.

The comparison, not a separate marketing homepage, is the visual anchor.
One file request divides into an allowed and a restricted path. Numbered steps
describe an actual sequence; color distinguishes access, not decoration.

## Palette and type

| Token | Light | Dark | Purpose |
| --- | --- | --- | --- |
| Workspace | #F4F6FA | #161E32 | Porcelain / deep-indigo canvas |
| Surface | #FFFFFF | #202B43 | Working panels |
| Ink | #24334C | #EBEFF8 | Primary text |
| Signal | #5143AC | #BAA6F4 | Iris selection and focus |
| Allowed | #137467 | #76DEC1 | Readable files |
| Denied | #AF324B | #FF9FAE | Restricted access and exposure |

The illustrative access panel uses a persistent indigo surface, contrasting
with the editable workspace in light mode. IBM Plex Sans is used for headings
and interface text; locally served IBM Plex Mono is reserved for file paths,
editable fixture text, and code. No external font requests are needed.

The theme follows the device unless explicitly changed. A header toggle saves
only `beacon.theme` in local storage, synchronizes between tabs, and continues
working if storage is unavailable. The More menu restores the device preference.
An external same-origin bootstrap script sets the theme before the stylesheet
and application load, without weakening the hosted script security policy.

## Hierarchy and navigation

```text
Beacon   Try it   How it works                 Walkthrough   Theme   More

Learn why AI needs access limits.              Show me an example
Plain-language purpose and simulation scope    Open a saved result

1 Choose a document   2 Ask a question   3 Compare access

Document + question                           Interactive access illustration
Options (closed)                              Paired answers after a run
Run comparison                                Access details / Export / Run info

Inspect run (closed)
  Events | Access path
```

The default screen explains the purpose and immediately presents the lab.
Secondary tools live in More. Hash links, page titles, Back, and Forward track
the selected view without discarding the in-memory draft. Mobile uses a compact
focus-contained navigation drawer and stacks the editor and results.

How it works provides selectable explanations, read-only document previews,
and the access illustration. Future AWS architecture and role inspections stay
available under an explicitly planned, collapsed section. The interaction
studio contains visual component demonstrations; Run locally shows actual
service readiness and startup commands.

## Practical walkthrough

The walkthrough demonstrates a normal leave question, lets the visitor add or
remove the misleading payroll instruction, and explores access to both files.
Expected behavior is labeled as illustration, never recorded evidence.
Use this example prepares the lab document, question, paired target, and scripted
behavior but does not execute a request. The replacement is disclosed before
activation, existing captures remain unchanged, and focus returns to the editor.
Closing without applying an example restores focus to the triggering control.

Actual results use Too much access and Limited access rather than unexplained
profile names. Private-file request, reading, assistant delivery, and answer
disclosure remain separate measurements. Imported results retain an unverified
source notice; changed drafts cannot rewrite existing captures.

## Interaction and restraint

Eight pinned React Bits adaptations share the existing Motion dependency.
MagneticButton adapts Magnet into a native button: its contents attract or repel
by at most five pixels, while the click target remains stationary. The behavior
is shared by navigation, walkthrough actions, explanations, document controls,
exports, copying, and replay controls. Touch, coarse pointers, disabled controls,
and reduced motion use static buttons. No global pointer listener is needed.

RubberSegment animates scoped document/template selection. SpotlightCard follows
local pointer or keyboard focus. ClickSpark draws a bounded, demand-only burst
for the run action and stops when complete. Results reveal only after capture;
there are no continuous decorative backgrounds or ambient loops.

System and explicit reduced-motion preferences work at runtime. Native controls,
visible focus, text/icon access states, keyboard list/graph navigation, modal
focus handling, and a graph text alternative remain available. Exiting
walkthrough steps become inert so invisible controls cannot receive focus.

The screen uses progressively disclosed options, measurements, exports, and
inspection. There is one empty state before execution, not duplicate empty
results or graphs. Copy is task-focused, with no decorative slogans or long
dashes. The shared split-access illustration is the distinctive element;
the surrounding interface remains quiet.
