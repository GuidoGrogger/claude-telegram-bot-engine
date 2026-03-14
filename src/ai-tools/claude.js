const { spawn } = require("child_process");
const { buildImagePrompt } = require("../images");

const MODEL_IDS = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-5-20250929",
  opus: "claude-opus-4-6",
};

const DEFAULT_MODEL = "haiku";

function runAITool(prompt, sessionId, { onText, onTool, model, images } = {}) {
  return new Promise((resolve) => {
    const modelId = MODEL_IDS[model] || MODEL_IDS[DEFAULT_MODEL];
    const effectivePrompt = buildImagePrompt(prompt, images);
    const args = [
      "--print",
      "--model",
      modelId,
      "--dangerously-skip-permissions",
      "--output-format",
      "stream-json",
      "--verbose",
      "--include-partial-messages",
      "--append-system-prompt",
      "IMPORTANT: Do not use your auto-memory system. Do not read from or write to ~/.claude/projects/ memory files (MEMORY.md or any files in the memory/ subdirectory there). All memory and knowledge should be stored exclusively in the project's own memory/ directory.",
      "-p",
      effectivePrompt,
    ];

    if (sessionId) {
      args.push("--resume", sessionId);
    }

    console.log("[claude] spawning:", "claude", args.join(" "));
    const proc = spawn("claude", args, { env: process.env });
    proc.stdin.end();

    let buffer = "";
    let stderrBuf = "";
    let resolved = false;

    function finish(result) {
      if (resolved) return;
      resolved = true;
      console.log("[claude] finished:", JSON.stringify(result).slice(0, 300));
      resolve(result);
    }

    function parseLine(line) {
      if (!line.trim()) return;
      let event;
      try {
        event = JSON.parse(line);
      } catch (e) {
        console.log("[claude] non-json line:", line.slice(0, 200));
        return;
      }

      console.log("[claude] event:", event.type, event.subtype || "");

      if (event.type === "assistant" && event.message?.content) {
        const text = extractText(event.message.content);
        const tools = extractTools(event.message.content);
        if (text) {
          console.log("[claude] text update:", text.slice(0, 100));
          if (onText) onText(text);
        }
        if (tools.length) {
          console.log("[claude] tools:", tools);
          if (onTool) onTool(tools);
        }
      }

      if (event.type === "result") {
        finish({
          text: event.result || "",
          sessionId: event.session_id,
          cost: event.total_cost_usd || 0,
          isError: event.is_error || false,
        });
      }
    }

    proc.stdout.on("data", (chunk) => {
      const str = chunk.toString();
      console.log("[claude] stdout chunk:", str.length, "bytes");
      buffer += str;
      const lines = buffer.split("\n");
      buffer = lines.pop();
      lines.forEach(parseLine);
    });

    proc.stderr.on("data", (chunk) => {
      const str = chunk.toString();
      stderrBuf += str;
      console.log("[claude] stderr:", str.trimEnd());
    });

    proc.on("close", (code) => {
      console.log("[claude] process closed with code:", code);
      if (stderrBuf.trim()) {
        console.log("[claude] full stderr:", stderrBuf.trimEnd());
      }
      if (buffer.trim()) parseLine(buffer);
      if (!resolved) {
        finish({
          text: `Claude exited with code ${code}\n${stderrBuf}`.trim(),
          sessionId: null,
          cost: 0,
          isError: true,
        });
      }
    });

    proc.on("error", (err) => {
      console.error("[claude] spawn error:", err.message);
      finish({
        text: `Failed to start claude: ${err.message}`,
        sessionId: null,
        cost: 0,
        isError: true,
      });
    });
  });
}

function extractText(content) {
  return content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");
}

function extractTools(content) {
  return content.filter((c) => c.type === "tool_use").map((c) => c.name);
}

module.exports = { runAITool, extractText, extractTools, MODEL_IDS, DEFAULT_MODEL };
