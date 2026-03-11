// @github/copilot-sdk is ESM-only, so we lazy-load via dynamic import()
let _sdk = null;
async function getSDK() {
  if (!_sdk) _sdk = await import("@github/copilot-sdk");
  return _sdk;
}

const MODEL_IDS = {
  haiku: "claude-haiku-4.5",
  sonnet: "claude-sonnet-4.6",
  opus: "claude-opus-4.6",
};

const DEFAULT_MODEL = "haiku";

// Shared client instance — lazily initialized, reused across calls
let sharedClient = null;

async function getClient() {
  if (sharedClient && sharedClient.getState() === "connected") {
    return sharedClient;
  }
  const { CopilotClient } = await getSDK();
  sharedClient = new CopilotClient({ autoStart: true });
  await sharedClient.start();
  return sharedClient;
}

async function runAITool(prompt, sessionId, { onText, onTool, model } = {}) {
  const modelId = MODEL_IDS[model] || MODEL_IDS[DEFAULT_MODEL];
  const { approveAll } = await getSDK();
  let fullText = "";
  let allTools = new Set();
  let totalCost = 0;

  try {
    const client = await getClient();

    console.log("[copilot-sdk] creating session, model:", modelId, "resume:", sessionId || "none");

    let session;
    if (sessionId) {
      session = await client.resumeSession(sessionId, {
        onPermissionRequest: approveAll,
        model: modelId,
      });
    } else {
      session = await client.createSession({
        onPermissionRequest: approveAll,
        model: modelId,
      });
    }

    const actualSessionId = session.sessionId;

    // Handle streaming text deltas
    session.on("assistant.message_delta", (event) => {
      fullText += event.data.deltaContent;
      if (onText) onText(fullText);
    });

    // Handle complete assistant messages (includes tool requests)
    session.on("assistant.message", (event) => {
      if (event.data.content) {
        fullText = event.data.content;
        if (onText) onText(fullText);
      }
      if (event.data.toolRequests?.length) {
        const names = event.data.toolRequests.map((t) => t.name);
        names.forEach((n) => allTools.add(n));
        console.log("[copilot-sdk] tools:", names);
        if (onTool) onTool(names);
      }
    });

    // Track usage/cost
    session.on("assistant.usage", (event) => {
      if (event.data.cost) {
        totalCost += event.data.cost;
      }
    });

    // Handle errors
    session.on("session.error", (event) => {
      console.error("[copilot-sdk] session error:", event.data.errorType, event.data.message);
    });

    // Send message and wait for completion
    const response = await session.sendAndWait(
      { prompt },
      5 * 60 * 1000 // 5 minute timeout
    );

    // Extract final text from the response if available
    if (response?.data?.content) {
      fullText = response.data.content;
    }

    // Disconnect session (preserves data on disk for resume)
    await session.disconnect();

    // Estimate cost: each premium request costs ~$0.04
    const estimatedCost = totalCost > 0 ? totalCost * 0.04 : 0;

    return {
      text: fullText || "",
      sessionId: actualSessionId,
      cost: estimatedCost,
      isError: false,
    };
  } catch (err) {
    console.error("[copilot-sdk] error:", err.message);
    return {
      text: `Copilot SDK error: ${err.message}`,
      sessionId: null,
      cost: 0,
      isError: true,
    };
  }
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
