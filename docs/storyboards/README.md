# Storyboards — how directions are pitched to Diego

Diego decides by looking (2026-09-06: *"I'm a visual person... rethink how to share your ideas"*).
A direction is pitched as a strip of four frames of what a person sees, one line saying what it is,
depth one tap away (a panel per frame, "Dig deeper" per idea), and the choice made in chat. These are
the sources of the two pages published that day as claude.ai artifacts:

- `three-directions.template.html` (+ `three-directions.details.js`, spliced in before `<script>`):
  the Open Studio / Agents' Vernissage / Every painting a film. Diego kept 1 and 3, dropped 2.
- `the-reveal.template.html`: the approved synthesis, built from `docs/reveal.md`.

`{{STYLE}}` takes `style-block.html`; `{{tatami}}` etc. take data-URI thumbnails of real paintings
(420 px JPEG, made with sharp from the Blob URLs; ~30 KB each), because an artifact page may not load
images from other hosts. Build: replace the placeholders and publish the result with the Artifact tool.
