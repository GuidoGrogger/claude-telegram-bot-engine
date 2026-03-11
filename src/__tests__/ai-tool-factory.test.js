const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

describe("ai-tool-factory", () => {
  let origAiTool;

  beforeEach(() => {
    origAiTool = process.env.AI_TOOL;
    // Clear the require cache so factory re-reads env
    delete require.cache[require.resolve("../ai-tool-factory")];
  });

  afterEach(() => {
    if (origAiTool === undefined) {
      delete process.env.AI_TOOL;
    } else {
      process.env.AI_TOOL = origAiTool;
    }
    delete require.cache[require.resolve("../ai-tool-factory")];
  });

  it("defaults to claude when AI_TOOL is not set", () => {
    delete process.env.AI_TOOL;
    const { getAITool } = require("../ai-tool-factory");
    const tool = getAITool();
    assert.equal(typeof tool.runAITool, "function");
    assert.ok(tool.MODEL_IDS.haiku.includes("claude"));
  });

  it("returns claude tool when AI_TOOL=claude", () => {
    process.env.AI_TOOL = "claude";
    const { getAITool } = require("../ai-tool-factory");
    const tool = getAITool();
    assert.equal(typeof tool.runAITool, "function");
    assert.ok(tool.MODEL_IDS.haiku.includes("claude"));
  });

  it("returns copilot tool when AI_TOOL=copilot", () => {
    process.env.AI_TOOL = "copilot";
    const { getAITool } = require("../ai-tool-factory");
    const tool = getAITool();
    assert.equal(typeof tool.runAITool, "function");
    assert.ok(tool.MODEL_IDS.sonnet.includes("claude-sonnet"));
  });

  it("is case-insensitive", () => {
    process.env.AI_TOOL = "Claude";
    const { getAITool } = require("../ai-tool-factory");
    const tool = getAITool();
    assert.equal(typeof tool.runAITool, "function");
  });

  it("throws for unknown tool", () => {
    process.env.AI_TOOL = "unknown";
    const { getAITool } = require("../ai-tool-factory");
    assert.throws(() => getAITool(), /Unknown AI_TOOL: unknown/);
  });
});
