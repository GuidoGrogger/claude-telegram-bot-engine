const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { SessionStore } = require("../sessions");

describe("SessionStore", () => {
  let store;

  beforeEach(() => {
    store = new SessionStore();
  });

  describe("get/set", () => {
    it("returns null for unknown chatId", () => {
      assert.equal(store.get(123), null);
    });

    it("stores and retrieves a session", () => {
      store.set(1, "sess-abc", 0.05);
      const session = store.get(1);
      assert.equal(session.sessionId, "sess-abc");
      assert.equal(session.totalCost, 0.05);
    });

    it("accumulates cost across multiple set calls", () => {
      store.set(1, "sess-1", 0.10);
      store.set(1, "sess-2", 0.05);
      const session = store.get(1);
      assert.equal(session.sessionId, "sess-2");
      assert.closeTo(session.totalCost, 0.15, 0.0001);
    });

    it("defaults cost to 0 when omitted", () => {
      store.set(1, "sess-1");
      assert.equal(store.get(1).totalCost, 0);
    });

    it("preserves model when updating session", () => {
      store.setModel(1, "sonnet");
      store.set(1, "sess-1", 0.01);
      assert.equal(store.getModel(1), "sonnet");
    });
  });

  describe("clear", () => {
    it("removes a session", () => {
      store.set(1, "sess-1");
      store.clear(1);
      assert.equal(store.get(1), null);
    });

    it("does not throw for unknown chatId", () => {
      assert.doesNotThrow(() => store.clear(999));
    });
  });

  describe("getCost", () => {
    it("returns 0 for unknown chatId", () => {
      assert.equal(store.getCost(999), 0);
    });

    it("returns accumulated cost", () => {
      store.set(1, "s1", 0.10);
      store.set(1, "s2", 0.20);
      assert.closeTo(store.getCost(1), 0.30, 0.0001);
    });
  });

  describe("getModel/setModel", () => {
    it("returns null for unknown chatId", () => {
      assert.equal(store.getModel(999), null);
    });

    it("sets model on existing session", () => {
      store.set(1, "sess-1");
      store.setModel(1, "opus");
      assert.equal(store.getModel(1), "opus");
    });

    it("creates session entry when setting model on new chatId", () => {
      store.setModel(5, "haiku");
      assert.equal(store.getModel(5), "haiku");
      const session = store.get(5);
      assert.equal(session.sessionId, null);
      assert.equal(session.totalCost, 0);
    });

    it("overwrites previous model", () => {
      store.setModel(1, "haiku");
      store.setModel(1, "sonnet");
      assert.equal(store.getModel(1), "sonnet");
    });
  });
});

// Polyfill assert.closeTo for node:assert
assert.closeTo = (actual, expected, delta) => {
  assert.ok(
    Math.abs(actual - expected) <= delta,
    `Expected ${actual} to be close to ${expected} (±${delta})`
  );
};
