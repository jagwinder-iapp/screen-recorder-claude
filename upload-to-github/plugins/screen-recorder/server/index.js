#!/usr/bin/env node
// Screen Recorder MCP server (stdio).
//
// Lets Claude control the Screen Recorder macOS app. It has no dependencies and
// makes no internet connections. It only:
//   1. reads ~/Library/Application Support/ScreenRecorder/control.json, which the
//      app writes with a loopback port and a random per-launch token (mode 0600);
//   2. connects to 127.0.0.1:<port> and forwards each tool call as one JSON line;
//   3. launches the app with macOS `open` when it isn't running.
//
// Protocol: newline-delimited JSON-RPC 2.0 on stdin/stdout (MCP stdio transport).
// Logs go to stderr.

"use strict";

const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");
const readline = require("readline");
const { execFile } = require("child_process");

const SERVER_NAME = "screen-recorder";
const SERVER_VERSION = "1.0.0";
const BUNDLE_ID = "com.iapp.screenrecorder";
const SUPPORTED_PROTOCOLS = ["2024-11-05", "2025-03-26", "2025-06-18"];
const CONTROL_FILE = path.join(os.homedir(), "Library", "Application Support", "ScreenRecorder", "control.json");
const APP_DOWNLOAD_HINT =
  "Install Screen Recorder for Mac (see the plugin README for the download link), open it once, " +
  "and allow it in System Settings › Privacy & Security › Screen & System Audio Recording.";

function log(message) {
  process.stderr.write(`[screen-recorder] ${message}\n`);
}

// ---------------------------------------------------------------------------
// Tool catalog
// ---------------------------------------------------------------------------

function schema(properties, required = []) {
  const s = { type: "object", properties, additionalProperties: false };
  if (required.length) s.required = required;
  return s;
}

const targetProps = {
  mode: {
    type: "string",
    enum: ["display", "window", "area"],
    description:
      "What to capture. display = a whole screen, window = one app window, area = a rectangle of a screen. Default display.",
  },
  display_id: { type: "integer", description: "Display id from list_sources. Defaults to the main display." },
  window_id: { type: "integer", description: "Window id from list_sources (mode window)." },
  app: {
    type: "string",
    description: 'Mode window: match the window by app name or bundle id (case-insensitive substring), e.g. "Safari".',
  },
  window_title: { type: "string", description: "Mode window: match by window title substring." },
  area: {
    type: "object",
    description:
      "Mode area: rectangle in points from the display's top-left corner. Omit it to let the user drag out an area on screen.",
    properties: {
      x: { type: "number" },
      y: { type: "number" },
      width: { type: "number" },
      height: { type: "number" },
    },
    required: ["x", "y", "width", "height"],
  },
};

const pathProp = {
  type: "string",
  description: "Absolute path of a recording (from list_recordings or stop_recording). Defaults to the most recent recording.",
};

const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
const writes = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };

// name → { method on the app, timeout, tool definition }
const TOOLS = [
  {
    name: "get_status",
    title: "Get recorder status",
    description:
      "Get Screen Recorder's current state (idle/recording/paused/…), elapsed time, current/last file, save folder, permissions and default settings.",
    inputSchema: schema({}),
    annotations: readOnly,
    method: "status",
  },
  {
    name: "list_sources",
    title: "List displays and windows",
    description: "List the displays and on-screen windows that can be recorded or screenshotted, with their ids.",
    inputSchema: schema({}),
    annotations: readOnly,
    method: "list_sources",
  },
  {
    name: "start_recording",
    title: "Start screen recording",
    description:
      "Start a screen recording of a display, a window or an area. With duration_seconds the recording stops by itself; if it's ≤ 300 s the call waits and returns the saved file (set wait=false to return immediately). Without a duration, call stop_recording later. Recordings are saved as video files in the user's Screen Recorder folder on their Mac.",
    inputSchema: schema({
      ...targetProps,
      duration_seconds: { type: "number", minimum: 1, maximum: 3600, description: "Stop automatically after this many seconds." },
      wait: {
        type: "boolean",
        description: "Wait for a timed recording to finish and return the file. Default true when duration ≤ 300 s.",
      },
      system_audio: { type: "boolean", description: "Record system audio (default: user's setting)." },
      microphone: { type: "boolean", description: "Record the microphone (default: user's setting)." },
      camera: { type: "boolean", description: "Show the webcam bubble in the recording (default: user's setting)." },
      show_cursor: { type: "boolean", description: "Show the mouse cursor (default: user's setting)." },
      countdown: {
        type: "integer",
        minimum: 0,
        maximum: 30,
        description: "Seconds of on-screen countdown before recording. Default 0.",
      },
      open_after: {
        type: "boolean",
        description: "Open the recording in the app's player when it finishes (default: user's setting).",
      },
    }),
    annotations: writes,
    method: "start_recording",
  },
  {
    name: "stop_recording",
    title: "Stop screen recording",
    description: "Stop the current recording, save it, and return the file path, duration, resolution and size.",
    inputSchema: schema({}),
    annotations: writes,
    method: "stop_recording",
  },
  {
    name: "pause_recording",
    title: "Pause recording",
    description: "Pause the current recording (paused time is left out of the video).",
    inputSchema: schema({}),
    annotations: writes,
    method: "pause_recording",
  },
  {
    name: "resume_recording",
    title: "Resume recording",
    description: "Resume a paused recording.",
    inputSchema: schema({}),
    annotations: writes,
    method: "resume_recording",
  },
  {
    name: "take_screenshot",
    title: "Take screenshot",
    description:
      "Capture a screenshot of a display, window or area, save it to the Screen Recorder folder, and (by default) return the image so you can see it.",
    inputSchema: schema({
      ...targetProps,
      include_image: { type: "boolean", description: "Return the image in the result. Default true." },
      max_image_width: {
        type: "integer",
        minimum: 200,
        maximum: 4000,
        description: "Downscale the returned image to this width. Default 1600.",
      },
    }),
    annotations: writes,
    method: "take_screenshot",
  },
  {
    name: "list_recordings",
    title: "List recordings",
    description: "List recordings, GIFs and screenshots in the Screen Recorder folder, newest first.",
    inputSchema: schema({
      kind: { type: "string", enum: ["video", "gif", "screenshot"], description: "Only this kind." },
      limit: { type: "integer", minimum: 1, maximum: 200, description: "Default 20." },
    }),
    annotations: readOnly,
    method: "list_recordings",
  },
  {
    name: "get_video_frames",
    title: "Get frames from a video",
    description: "Extract evenly spaced frames from a video as images so you can see what was recorded.",
    inputSchema: schema({
      path: pathProp,
      count: { type: "integer", minimum: 1, maximum: 12, description: "Number of frames. Default 6." },
      start_seconds: { type: "number", minimum: 0 },
      end_seconds: { type: "number", minimum: 0 },
      max_width: { type: "integer", minimum: 200, maximum: 2000, description: "Frame width. Default 1024." },
    }),
    annotations: readOnly,
    method: "get_video_frames",
  },
  {
    name: "trim_recording",
    title: "Trim a recording",
    description: "Save a trimmed copy of a video (no re-encoding). The original is kept.",
    inputSchema: schema({
      path: pathProp,
      start_seconds: { type: "number", minimum: 0 },
      end_seconds: { type: "number", minimum: 0 },
    }),
    annotations: writes,
    method: "trim_recording",
  },
  {
    name: "export_gif",
    title: "Export GIF",
    description: "Convert a video (or part of it) into an animated GIF saved in the Screen Recorder folder.",
    inputSchema: schema({
      path: pathProp,
      width: { type: "integer", minimum: 120, maximum: 1920, description: "GIF width in pixels. Default 720." },
      fps: { type: "number", minimum: 1, maximum: 30, description: "Frames per second. Default 12." },
      start_seconds: { type: "number", minimum: 0 },
      end_seconds: { type: "number", minimum: 0 },
    }),
    annotations: writes,
    method: "export_gif",
  },
  {
    name: "open_recording",
    title: "Open a recording",
    description:
      "Open a recording in Screen Recorder's player window (or a screenshot/GIF in its default app) for the user.",
    inputSchema: schema({ path: pathProp }),
    annotations: writes,
    method: "open_recording",
  },
  {
    name: "show_app",
    title: "Show Screen Recorder",
    description: "Bring the Screen Recorder window to the front.",
    inputSchema: schema({}),
    annotations: writes,
    method: "show_app",
  },
];

const TOOLS_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

const INSTRUCTIONS =
  "Screen Recorder is a native macOS app on the user's Mac. Use these tools to record the screen, a window or an area " +
  "(with optional system audio, microphone and webcam bubble), take screenshots you can look at, and review, trim or " +
  "convert recordings to GIF. Recording the screen is visible to the user (menu bar timer and floating controls). " +
  "Use list_sources to find display/window ids. Prefer a duration_seconds for short recordings so the file comes back " +
  "in one call. Use get_video_frames to look at what a recording contains.";

function timeoutFor(name, args) {
  switch (name) {
    case "start_recording": {
      const duration = Number(args.duration_seconds) || 0;
      const countdown = Number(args.countdown) || 0;
      return Math.max(120, duration + countdown + 180) * 1000;
    }
    case "get_video_frames":
    case "export_gif":
    case "trim_recording":
    case "stop_recording":
      return 900 * 1000;
    case "take_screenshot":
      return 300 * 1000; // may wait for the user to drag out an area
    default:
      return 60 * 1000;
  }
}

// ---------------------------------------------------------------------------
// Talking to the app
// ---------------------------------------------------------------------------

class AppError extends Error {}

function readControlInfo() {
  let info;
  try {
    info = JSON.parse(fs.readFileSync(CONTROL_FILE, "utf8"));
  } catch {
    return null;
  }
  if (!Number.isInteger(info.port) || typeof info.token !== "string") return null;
  if (Number.isInteger(info.pid) && info.pid > 0) {
    try {
      process.kill(info.pid, 0); // throws if the app that wrote the file is gone
    } catch (err) {
      if (err.code === "ESRCH") return null;
    }
  }
  return info;
}

function findAppBundle() {
  const candidates = [
    process.env.SCREENRECORDER_APP,
    path.join(os.homedir(), "Applications", "ScreenRecorder.app"),
    "/Applications/ScreenRecorder.app",
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function launchApp() {
  const bundle = findAppBundle();
  const args = bundle ? ["-g", bundle] : ["-g", "-b", BUNDLE_ID];
  return new Promise((resolve, reject) => {
    execFile("/usr/bin/open", args, (err) => {
      if (err) reject(new AppError(`Couldn't launch Screen Recorder. ${APP_DOWNLOAD_HINT}`));
      else resolve();
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Sends one request line and resolves with the parsed reply line. */
function request(info, method, params, timeoutMs) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: "127.0.0.1", port: info.port });
    const chunks = [];
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      fn(value);
    };
    const timer = setTimeout(
      () => finish(reject, new AppError(`Screen Recorder took longer than ${Math.round(timeoutMs / 1000)} s to answer.`)),
      timeoutMs
    );
    socket.on("connect", () => {
      socket.write(JSON.stringify({ token: info.token, method, params }) + "\n");
    });
    socket.on("data", (chunk) => {
      chunks.push(chunk);
      if (chunk[chunk.length - 1] === 0x0a) socket.end();
    });
    socket.on("end", () => {
      try {
        finish(resolve, JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        finish(reject, new AppError("Screen Recorder sent an unreadable reply."));
      }
    });
    socket.on("error", (err) => finish(reject, err));
  });
}

async function callApp(method, params, timeoutMs) {
  let info = readControlInfo();
  let reply;
  try {
    if (!info) throw Object.assign(new Error("not running"), { code: "ECONNREFUSED" });
    reply = await request(info, method, params, timeoutMs);
  } catch (err) {
    if (err instanceof AppError) throw err;
    // App not running (or stale control file): launch it and retry for up to ~20 s.
    log("Screen Recorder isn't reachable; launching it…");
    await launchApp();
    const deadline = Date.now() + 20000;
    for (;;) {
      await sleep(250);
      info = readControlInfo();
      if (info) {
        try {
          reply = await request(info, method, params, timeoutMs);
          break;
        } catch (retryErr) {
          if (retryErr instanceof AppError) throw retryErr;
        }
      }
      if (Date.now() > deadline) {
        throw new AppError(
          "Screen Recorder didn't respond. Open the app, and make sure Settings › General › " +
            "“Allow Claude to control Screen Recorder” is on. " + APP_DOWNLOAD_HINT
        );
      }
    }
  }
  if (reply && reply.ok === true) return reply.result || {};
  throw new AppError((reply && reply.error) || "Unknown error from Screen Recorder.");
}

// ---------------------------------------------------------------------------
// JSON-RPC plumbing
// ---------------------------------------------------------------------------

function send(message) {
  process.stdout.write(JSON.stringify(message) + "\n");
}
const respond = (id, result) => send({ jsonrpc: "2.0", id, result });
const respondError = (id, code, message) => send({ jsonrpc: "2.0", id, error: { code, message } });

async function callTool(id, params) {
  const tool = TOOLS_BY_NAME.get(params && params.name);
  if (!tool) return respondError(id, -32602, `Unknown tool: ${params && params.name}`);
  const args = (params && params.arguments) || {};
  try {
    const result = await callApp(tool.method, args, timeoutFor(tool.name, args));
    let text = result.summary || "Done.";
    if (result.data && Object.keys(result.data).length) text += "\n\n" + JSON.stringify(result.data, null, 2);
    const content = [{ type: "text", text }];
    for (const image of result.images || []) {
      if (image && typeof image.data === "string") {
        content.push({ type: "image", data: image.data, mimeType: image.mimeType || "image/jpeg" });
      }
    }
    respond(id, { content, isError: false });
  } catch (err) {
    const message =
      err instanceof AppError ? err.message : `Couldn't reach Screen Recorder (${err.message}). ${APP_DOWNLOAD_HINT}`;
    respond(id, { content: [{ type: "text", text: message }], isError: true });
  }
}

function handle(message) {
  if (!message || typeof message !== "object") return;
  const { id, method } = message;
  const params = message.params || {};
  if (id === undefined || id === null) return; // notifications need no reply

  switch (method) {
    case "initialize":
      respond(id, {
        protocolVersion: SUPPORTED_PROTOCOLS.includes(params.protocolVersion)
          ? params.protocolVersion
          : SUPPORTED_PROTOCOLS[SUPPORTED_PROTOCOLS.length - 1],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: SERVER_NAME, title: "Screen Recorder", version: SERVER_VERSION },
        instructions: INSTRUCTIONS,
      });
      break;
    case "ping":
      respond(id, {});
      break;
    case "tools/list":
      respond(id, {
        tools: TOOLS.map(({ name, title, description, inputSchema, annotations }) => ({
          name,
          title,
          description,
          inputSchema,
          annotations: { title, ...annotations },
        })),
      });
      break;
    case "tools/call":
      callTool(id, params); // runs concurrently so pings are still answered during long calls
      break;
    case "resources/list":
      respond(id, { resources: [] });
      break;
    case "prompts/list":
      respond(id, { prompts: [] });
      break;
    default:
      respondError(id, -32601, `Method not found: ${method}`);
  }
}

if (process.argv.includes("--version")) {
  process.stdout.write(`${SERVER_NAME} ${SERVER_VERSION}\n`);
  process.exit(0);
}

if (process.platform !== "darwin") {
  log("Screen Recorder only runs on macOS; tool calls will fail on this platform.");
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
    return;
  }
  if (Array.isArray(message)) message.forEach(handle);
  else handle(message);
});
