const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { extractText, extractTools, MODEL_IDS, DEFAULT_MODEL } = require("../ai-tools/copilot");

describe("copilot extractText", () => {
  it("extracts text from content array", () => {
    const content = [
      { type: "text", text: "Hello" },
      { type: "text", text: "World" },
    ];
    assert.equal(extractText(content), "Hello\nWorld");
  });

  it("handles string content directly", () => {
    assert.equal(extractText("plain string"), "plain string");
  });

  it("returns empty string for non-array non-string", () => {
    assert.equal(extractText(null), "");
    assert.equal(extractText(42), "");
  });

  it("ignores non-text content blocks", () => {
    const content = [
      { type: "text", text: "Hello" },
      { type: "tool_use", name: "view", input: {} },
    ];
    assert.equal(extractText(content), "Hello");
  });

  it("returns empty string for empty array", () => {
    assert.equal(extractText([]), "");
  });
});

describe("copilot extractTools", () => {
  it("extracts tool names from content array", () => {
    const content = [
      { type: "tool_use", name: "view", input: {} },
      { type: "tool_use", name: "edit", input: {} },
    ];
    assert.deepEqual(extractTools(content), ["view", "edit"]);
  });

  it("returns empty array for non-array input", () => {
    assert.deepEqual(extractTools("string"), []);
    assert.deepEqual(extractTools(null), []);
  });

  it("returns empty array for empty array", () => {
    assert.deepEqual(extractTools([]), []);
  });
});

describe("copilot MODEL_IDS", () => {
  it("has entries for haiku, sonnet, and opus", () => {
    assert.ok(MODEL_IDS.haiku);
    assert.ok(MODEL_IDS.sonnet);
    assert.ok(MODEL_IDS.opus);
  });

  it("uses copilot-style model names", () => {
    // Copilot uses short names like claude-haiku-4.5 instead of full IDs
    assert.ok(!MODEL_IDS.haiku.includes("20251001"));
  });

  it("default model is haiku", () => {
    assert.equal(DEFAULT_MODEL, "haiku");
  });
});
