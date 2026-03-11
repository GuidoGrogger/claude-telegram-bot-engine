const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { buildCommitMessage } = require("../git");

describe("buildCommitMessage", () => {
  it("formats new session message", () => {
    const msg = buildCommitMessage({
      messageText: "Hello bot",
      username: "Guido",
      cost: 0.0123,
      totalCost: 0.0123,
      isContinuation: false,
    });
    assert.ok(msg.startsWith('[Bot] @Guido: "Hello bot"'));
    assert.ok(msg.includes("Kosten: $0.0123"));
    assert.ok(!msg.includes("Fortsetzung"));
    assert.ok(!msg.includes("Gesamt"));
  });

  it("formats continuation message", () => {
    const msg = buildCommitMessage({
      messageText: "Follow up",
      username: "Thorsten",
      cost: 0.005,
      totalCost: 0.015,
      isContinuation: true,
    });
    assert.ok(msg.startsWith('[Bot/Fortsetzung] @Thorsten: "Follow up"'));
    assert.ok(msg.includes("Neue Kosten: $0.0050"));
    assert.ok(msg.includes("Gesamt: $0.0150"));
  });

  it("handles special characters in message text", () => {
    const msg = buildCommitMessage({
      messageText: 'Quotes "and" newlines\nhere',
      username: "user",
      cost: 0,
      totalCost: 0,
      isContinuation: false,
    });
    assert.ok(msg.includes('Quotes "and" newlines\nhere'));
  });

  it("formats costs to 4 decimal places", () => {
    const msg = buildCommitMessage({
      messageText: "test",
      username: "u",
      cost: 0.1,
      totalCost: 0.2,
      isContinuation: true,
    });
    assert.ok(msg.includes("$0.1000"));
    assert.ok(msg.includes("$0.2000"));
  });
});
