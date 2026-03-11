function getAITool() {
  const toolName = (process.env.AI_TOOL || "claude").toLowerCase();

  if (toolName === "claude") {
    return require("./ai-tools/claude");
  } else if (toolName === "copilot") {
    return require("./ai-tools/copilot");
  }
  throw new Error(`Unknown AI_TOOL: ${toolName}. Supported: claude, copilot`);
}

module.exports = { getAITool };
