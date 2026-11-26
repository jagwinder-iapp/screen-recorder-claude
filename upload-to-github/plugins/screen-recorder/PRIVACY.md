# Privacy Policy: Screen Recorder plugin for Claude

_Last updated: 26 November 2026_

The Screen Recorder plugin connects Claude to the Screen Recorder app on your Mac. It is built to keep your data on your computer.

## What the plugin does
- It runs a small local program (`server/index.js`) that Claude starts on your Mac.
- That program reads `~/Library/Application Support/ScreenRecorder/control.json`. The Screen Recorder app writes this file; only your macOS user can read it. It holds a local port number and a random token that changes every time the app starts.
- It sends Claude's requests (for example "start recording", "take a screenshot", "list recordings") to the app over `127.0.0.1`, which never leaves your computer.
- If the app isn't running, it starts it with the macOS `open` command.

## What it does not do
- The plugin makes **no internet connections**. It doesn't use analytics or tracking, and it doesn't send anything to iApp or anyone else.
- Recordings, screenshots and GIFs are saved only on your Mac, in your Screen Recorder folder (`~/Movies/Screen Recorder` by default). The plugin never uploads them.

## Data shared with Claude
When you ask Claude to look at your screen or a recording, the requested content becomes part of your conversation with Claude:
- the screenshot from `take_screenshot` (on by default; Claude can turn it off with `include_image: false`)
- the frames from `get_video_frames`
- text details such as file names, paths, durations, and the titles of open windows (from `list_sources`)

Anthropic then processes that content under the terms and privacy policy of the Claude product you use. Only ask Claude to capture or view screens and recordings you're comfortable sharing.

## Your controls
- Screen recording requires macOS's Screen Recording permission, which you grant and can revoke in System Settings › Privacy & Security.
- You can turn off Claude's access at any time with Screen Recorder › Settings › General › "Allow Claude to control Screen Recorder", or by uninstalling the plugin.
- Delete any recording by moving it to the Trash.
- The app shows a menu bar timer and floating controls whenever it is recording.

## Children
This plugin is not directed at children under 18.

## Contact
Questions about this policy: open an issue at https://github.com/jagwinder-iapp/screen-recorder-claude/issues.
