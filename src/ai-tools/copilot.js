const { spawn } = require("child_process");

const MODEL_IDS = {
  haiku: "claude-haiku-4.5",
  sonnet: "claude-sonnet-4.6",
  opus: "claude-opus-4.6",
};

const DEFAULT_MODEL = "haiku";

function runAITool(prompt, sessionId, { onText, onTool, model } = {}) {
  return new Promise((resolve) => {
    const modelId = MODEL_IDS[model] || MODEL_IDS[DEFAULT_MODEL];
    const args = [
      "-p",
      prompt,
      "--model",
      modelId,
      "--output-format",
      "json",
      "--allow-all",
      "--autopilot",
    ];

    if (sessionId) {
      args.push("--resume", sessionId);
    }

    console.log("[copilot] spawning:", "copilot", args.join(" "));
    const proc = spawn("copilot", args, { env: process.env });
    proc.stdin.end();

    let buffer = "";
    let stderrBuf = "";
    let resolved = false;
    let fullText = "";
    let allTools = [];

    function finish(result) {
      if (resolved) return;
      resolved = true;
      console.log("[copilot] finished:", JSON.stringify(result).slice(0, 300));
      resolve(result);
    }

    function parseLine(line) {
      if (!line.trim()) return;
      let event;
      try {
        event = JSON.parse(line);
      } catch (e) {
        console.log("[copilot] non-json line:", line.slice(0, 200));
        return;
      }

      const type = event.type || "";
      console.log("[copilot] event:", type);

      // Text streaming delta
      if (type === "assistant.message_delta" && event.textDelta) {
        fullText += event.textDelta;
        console.log("[copilot] text delta:", event.textDelta.slice(0, 100));
        if (onText) onText(fullText);
      }

      // Complete message with tool requests
      if (type === "assistant.message") {
        if (event.message?.content) {
          fullText = extractText(event.message.content);
        }
        if (event.toolRequests?.length) {
          const names = event.toolRequests.map((t) => t.name);
          allTools.push(...names);
          console.log("[copilot] tools:", names);
          if (onTool) onTool(names);
        }
        if (fullText && onText) onText(fullText);
      }

      // Final result
      if (type === "result") {
        const premiumRequests = event.usage?.premiumRequests || 0;
        const estimatedCost = premiumRequests * 0.04;
        finish({
          text: event.result || fullText || "",
          sessionId: event.sessionId || null,
          cost: estimatedCost,
          isError: event.exitCode !== 0,
        });
      }
    }

    proc.stdout.on("data", (chunk) => {
      const str = chunk.toString();
      console.log("[copilot] stdout chunk:", str.length, "bytes");
      buffer += str;
      const lines = buffer.split("\n");
      buffer = lines.pop();
      lines.forEach(parseLine);
    });

    proc.stderr.on("data", (chunk) => {
      const str = chunk.toString();
      stderrBuf += str;
      console.log("[copilot] stderr:", str.trimEnd());
    });

    proc.on("close", (code) => {
      console.log("[copilot] process closed with code:", code);
      if (stderrBuf.trim()) {
        console.log("[copilot] full stderr:", stderrBuf.trimEnd());
      }
      if (buffer.trim()) parseLine(buffer);
      if (!resolved) {
        finish({
          text: `Copilot exited with code ${code}\n${stderrBuf}`.trim(),
          sessionId: null,
          cost: 0,
          isError: true,
        });
      }
    });

    proc.on("error", (err) => {
      console.error("[copilot] spawn error:", err.message);
      finish({
        text: `Failed to start copilot: ${err.message}`,
        sessionId: null,
        cost: 0,
        isError: true,
      });
    });
  });
}

function extractText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");
}

function extractTools(content) {
  if (!Array.isArray(content)) return [];
  return content.filter((c) => c.type === "tool_use").map((c) => c.name);
}

module.exports = { runAITool, extractText, extractTools, MODEL_IDS, DEFAULT_MODEL };
