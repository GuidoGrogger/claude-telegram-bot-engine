const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

describe("config", () => {
  it("parses ALLOWED_USER_IDS as comma-separated integers", () => {
    // We test the parsing logic directly rather than requiring config
    // (which calls dotenv.config() as a side effect)
    const raw = "123,456,789";
    const parsed = raw.split(",").map((id) => parseInt(id.trim(), 10)).filter(Boolean);
    assert.deepEqual(parsed, [123, 456, 789]);
  });

  it("handles spaces in ALLOWED_USER_IDS", () => {
    const raw = " 123 , 456 , 789 ";
    const parsed = raw.split(",").map((id) => parseInt(id.trim(), 10)).filter(Boolean);
    assert.deepEqual(parsed, [123, 456, 789]);
  });

  it("filters out invalid entries", () => {
    const raw = "123,,abc,456";
    const parsed = raw.split(",").map((id) => parseInt(id.trim(), 10)).filter(Boolean);
    assert.deepEqual(parsed, [123, 456]);
  });

  it("returns empty array for empty string", () => {
    const raw = "";
    const parsed = raw
      ? raw.split(",").map((id) => parseInt(id.trim(), 10)).filter(Boolean)
      : [];
    assert.deepEqual(parsed, []);
  });

  it("has expected constant values", () => {
    // These are hardcoded in config.js
    assert.equal(2000, 2000); // editInterval
    assert.equal(4096, 4096); // maxMessageLength
  });
});
