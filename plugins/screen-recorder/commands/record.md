---
description: Record the screen, a window, or an area with Screen Recorder
argument-hint: "[what to record] [for N seconds]"
---

Use the screen-recorder MCP tools to make a screen recording.

Request: $ARGUMENTS

- If no target is given, record the main display. If an app is named, record that app's window (`mode: "window"`, `app`). If the user wants to pick a region, use `mode: "area"` without `area`, so they can drag one out.
- If a length is given, pass `duration_seconds` and wait for the saved file. Otherwise start the recording, tell the user it's running, and stop it with `stop_recording` when they say so.
- When it's done, report the file path, the duration and the resolution, and offer to show frames, trim it, or make a GIF.
