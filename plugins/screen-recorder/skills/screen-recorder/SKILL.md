---
name: screen-recorder
description: Record the Mac's screen, a window or an area, take screenshots, and review, trim or convert recordings with the Screen Recorder app. Use when the user asks to record or capture their screen, make a demo or bug-repro video, grab a screenshot of their screen or an app window, turn a recording into a GIF, or look at what a recording shows.
---

# Screen Recorder

The `screen-recorder` MCP tools drive the native **Screen Recorder** app on this Mac (in `/Applications` or `~/Applications`). If the app isn't running, the tools launch it. If a tool says the app couldn't be launched, the user needs to install it first; the plugin README has the download link.

## Choosing a target
- **Whole screen**: `mode: "display"` (the default). If there are several monitors, call `list_sources` and pass `display_id`.
- **One app window**: `mode: "window"` plus `app` (e.g. `"Safari"`) and optionally `window_title`, or a `window_id` from `list_sources`.
- **Part of the screen**: `mode: "area"` with `area: {x, y, width, height}` in points from the display's top-left. If you leave out `area`, the user drags one out on screen. Only do that when they've asked to pick the area themselves.

## Recording
- For short clips, pass `duration_seconds`. If it's 300 s or less, the call waits and returns the saved file in one step.
- For open-ended recordings, call `start_recording` without a duration, tell the user it's running, then call `stop_recording` when they say so. While it records, the menu bar shows a red timer and a floating pause/stop bar.
- Audio, microphone, camera bubble and cursor follow the user's settings unless you pass `system_audio`, `microphone`, `camera` or `show_cursor`. Only turn on `microphone` or `camera` when the user asks.
- `countdown` defaults to 0 for tool calls. Give 3 when the user needs time to get ready.

## Seeing results
- `take_screenshot` returns the image by default, so you can describe or analyze it.
- `get_video_frames` returns evenly spaced frames from a recording. Use it to check what a video shows before you summarize it.
- `trim_recording` and `export_gif` write new files and keep the original. `open_recording` shows a file to the user.

## Things to keep in mind
- Recording the screen is visible and personal. Start a recording only when the user asked for one, and tell them when it starts and stops.
- If a tool reports that Screen Recording permission is missing, ask the user to allow **Screen Recorder** in System Settings › Privacy & Security › Screen & System Audio Recording, then reopen the app.
- If a tool says Claude control is off, the user can turn it back on in Screen Recorder › Settings › General › "Allow Claude to control Screen Recorder".
- Files are saved in the user's Screen Recorder folder (`~/Movies/Screen Recorder` by default). Always report the saved path.
- Screenshots and frames you request are sent to you as part of the conversation, so only capture what the user asked for.
