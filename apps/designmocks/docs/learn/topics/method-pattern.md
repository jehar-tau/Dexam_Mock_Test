# The method pattern

Engine `src/learn/method.js` · decks `src/learn/decks/product.js` and
`communication.js`, plus the authored items in `src/learn/physics.js` ·
tests `tests/method.test.mjs`. Built 16 November 2026.

A method deck teaches a design method step by step. For each step (a
`kind`) it holds authored items: a brief or prompt, one right answer,
three wrong ones (each with its own reason where it helps) and why the
right one is right. Some items are computed so they can be checked: ramp
slopes, design-process order, pendulum frames at equal time steps.

Lessons walk through the method with slides, check each step with items,
and end with a **checklist** the student uses on their own drawing; the
drawing itself is marked in the portal, not here.

All briefs are our own; the methods follow the owner's theory guides.
`tests/method.test.mjs` checks that every item has four distinct options
and a reason, re-checks the computed items, and builds every kind at every
level.
