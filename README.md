# Screen Recorder for Claude

A Claude plugin for the **Screen Recorder** Mac app. Ask Claude to record your screen, a window or an area, take screenshots it can see, and review, trim or turn recordings into GIFs. Everything stays on your Mac.

## Get started
1. **Install the app:** download `ScreenRecorder.dmg` from [Releases](https://github.com/jagwinder-iapp/screen-recorder-claude/releases/latest), drag it to Applications, open it, and allow Screen Recording when macOS asks.
2. **Install the plugin** in Claude Code:
   ```
   /plugin install screen-recorder --marketplace jagwinder-iapp/screen-recorder-claude
   ```
3. Ask Claude: *"Record my screen for 10 seconds and show me what you captured."*

The plugin needs macOS 15 or later and Node.js 18 or later. See the [plugin README](plugins/screen-recorder/README.md) for what it runs and sends, and the [privacy policy](PRIVACY.md).

## Repository layout
- `.claude-plugin/marketplace.json`: the `iapp-tools` marketplace
- `plugins/screen-recorder/`: the plugin (MCP server, skill, commands)

## License
Proprietary. © 2026 iApp. See [LICENSE](LICENSE).
