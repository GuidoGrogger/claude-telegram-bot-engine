// Backwards-compatible re-export from new location
const tool = require("./ai-tools/claude");

module.exports = {
  runClaude: tool.runAITool,
  extractText: tool.extractText,
  extractTools: tool.extractTools,
  MODEL_IDS: tool.MODEL_IDS,
  DEFAULT_MODEL: tool.DEFAULT_MODEL,
};
