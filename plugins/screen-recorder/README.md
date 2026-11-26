# Screen Recorder for Claude

Control the **Screen Recorder** Mac app from Claude. Claude can record your whole screen, one app window or an area of the screen, with system audio, microphone and a webcam bubble. It can also take screenshots and look at them, pull frames out of a recording to see what it shows, trim recordings, and turn them into GIFs. Everything is saved on your Mac.

## Install
```
/plugin install screen-recorder --marketplace jagwinder-iapp/screen-recorder-claude
```
Or from a terminal:
```
claude plugin marketplace add jagwinder-iapp/screen-recorder-claude
claude plugin install screen-recorder@iapp-tools
```

## Requirements
- **macOS 15 or later.** The plugin only works on a Mac.
- **The Screen Recorder app.** Download it from https://github.com/jagwinder-iapp/screen-recorder-claude/releases/latest, move it to Applications, and open it once.
- **Screen Recording permission** for Screen Recorder: System Settings › Privacy & Security › Screen & System Audio Recording.
- **Node.js 18 or later**, available as `node`. Claude runs the plugin's small server with it.

## What you can ask
- "Record my screen for 20 seconds."
- "Record the Safari window until I say stop."
- "Take a screenshot of Xcode and tell me what the error says."
- "Show me what's in my last recording."
- "Make a GIF of the first 5 seconds of that recording."

## Tools
`get_status`, `list_sources`, `start_recording`, `stop_recording`, `pause_recording`, `resume_recording`, `take_screenshot`, `list_recordings`, `get_video_frames`, `trim_recording`, `export_gif`, `open_recording`, `show_app`.

The plugin also includes the `screen-recorder` skill and the `/screen-recorder:record` and `/screen-recorder:screenshot` commands.

## What it runs, sends and fetches
- **Runs:** `node server/index.js`, a dependency-free MCP server (stdio). It is the only code in this plugin. If the app isn't running, the server starts it with `/usr/bin/open`.
- **Reads:** `~/Library/Application Support/ScreenRecorder/control.json`, which the app writes with mode 0600. It holds a local port and a random token that changes on every launch.
- **Sends:** tool requests and their arguments to the Screen Recorder app at `127.0.0.1` only. The plugin makes no internet connections and collects no analytics.
- **Returns to Claude:** text results (file paths, durations, window titles). When requested, it also returns screenshot images and video frames, which become part of your Claude conversation.
- **Writes:** nothing itself. The app saves recordings, screenshots, trimmed copies and GIFs to your Screen Recorder folder (`~/Movies/Screen Recorder` by default).

See [PRIVACY.md](PRIVACY.md) for details. You can turn off Claude's access in Screen Recorder › Settings › General › "Allow Claude to control Screen Recorder".

## License
Proprietary. See [LICENSE](LICENSE).
