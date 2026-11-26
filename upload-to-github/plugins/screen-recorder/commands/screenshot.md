---
description: Take a screenshot with Screen Recorder and look at it
argument-hint: "[screen | app name | area]"
---

Take a screenshot with the screen-recorder `take_screenshot` tool.

Request: $ARGUMENTS

- No target: capture the main display. An app name: `mode: "window"` with `app`. "area" or "region": `mode: "area"`, so the user drags out the region.
- Look at the returned image and briefly describe what it shows (or answer the user's question about it), then give the saved file path.
