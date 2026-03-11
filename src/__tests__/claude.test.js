const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { extractText, extractTools, MODEL_IDS, DEFAULT_MODEL } = require("../claude");
const aiToolsClaude = require("../ai-tools/claude");

describe("extractText", () => {
  it("extracts text from content array", () => {
    const content = [
      { type: "text", text: "Hello" },
      { type: "text", text: "World" },
    ];
    assert.equal(extractText(content), "Hello\nWorld");
  });

  it("ignores non-text content blocks", () => {
    const content = [
      { type: "text", text: "Hello" },
      { type: "tool_use", name: "Read", input: {} },
      { type: "text", text: "World" },
    ];
    assert.equal(extractText(content), "Hello\nWorld");
  });

  it("returns empty string for no text blocks", () => {
    const content = [{ type: "tool_use", name: "Bash", input: {} }];
    assert.equal(extractText(content), "");
  });

  it("returns empty string for empty array", () => {
    assert.equal(extractText([]), "");
  });
});

describe("extractTools", () => {
  it("extracts tool names from content array", () => {
    const content = [
      { type: "tool_use", name: "Read", input: {} },
      { type: "tool_use", name: "Write", input: {} },
    ];
    assert.deepEqual(extractTools(content), ["Read", "Write"]);
  });

  it("ignores non-tool content blocks", () => {
    const content = [
      { type: "text", text: "Hello" },
      { type: "tool_use", name: "Bash", input: {} },
    ];
    assert.deepEqual(extractTools(content), ["Bash"]);
  });

  it("returns empty array for no tool blocks", () => {
    const content = [{ type: "text", text: "Hello" }];
    assert.deepEqual(extractTools(content), []);
  });

  it("returns empty array for empty array", () => {
    assert.deepEqual(extractTools([]), []);
  });
});

describe("MODEL_IDS", () => {
  it("has entries for haiku, sonnet, and opus", () => {
    assert.ok(MODEL_IDS.haiku);
    assert.ok(MODEL_IDS.sonnet);
    assert.ok(MODEL_IDS.opus);
  });

  it("default model is haiku", () => {
    assert.equal(DEFAULT_MODEL, "haiku");
  });
});

describe("backwards-compat re-export", () => {
  it("re-exports runAITool as runClaude", () => {
    const { runClaude } = require("../claude");
    assert.equal(typeof runClaude, "function");
    assert.equal(runClaude, aiToolsClaude.runAITool);
  });

  it("re-exports helpers from ai-tools/claude", () => {
    assert.equal(extractText, aiToolsClaude.extractText);
    assert.equal(extractTools, aiToolsClaude.extractTools);
    assert.deepEqual(MODEL_IDS, aiToolsClaude.MODEL_IDS);
    assert.equal(DEFAULT_MODEL, aiToolsClaude.DEFAULT_MODEL);
  });
});
