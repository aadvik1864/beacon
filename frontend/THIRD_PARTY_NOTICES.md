# React Bits attribution

This application contains modified React Bits components by **David Haz**:
https://reactbits.dev/ · https://github.com/DavidHDev/react-bits

Source revision: `f586a29d6b90a9bf8027b76e978a82230160b8c6`.

| Local component | Upstream source |
| --- | --- |
| Stepper.tsx | src/ts-tailwind/Components/Stepper/Stepper.tsx |
| AnimatedList.tsx | src/ts-tailwind/Components/AnimatedList/AnimatedList.tsx |
| CallChip.tsx | src/ts-tailwind/Micro/CallChip/CallChip.tsx |
| StatusMark.tsx | src/ts-tailwind/Micro/StatusMark/StatusMark.tsx |

Modifications: light-workbench theming; semantic buttons and scoped keyboard
navigation instead of global Tab interception; explicit reduced-motion controls;
responsive sizing; ResizeObserver-based step measurement; optional controlled
list selection; and Lucide icons shared with the application in place of the
CallChip's separate Hugeicons dependencies. CallChip estimated progress/timing is
removed: preview states are not measured requests or security evidence. The
experiment view now uses CallChip/StatusMark for observed local outcomes and
AnimatedList for recorded events, with empty filtered selection handling and
contrast adjustments. These are still not AWS events.

Components are included as part of this application, not distributed as a
standalone component package. See the complete retained license below.

---

MIT + Commons Clause License Condition v1.0

Copyright (c) 2026 David Haz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, and distribute the Software **as part of an application, website, or product**, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

## Commons Clause Restriction

You may use this Software, including for any commercial purpose, **so long as you do not sell, sublicense, or redistribute the components themselves-whether alone, in a bundle, or as a ported version.**

## No Warranty

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
