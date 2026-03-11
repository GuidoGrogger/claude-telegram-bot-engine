const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { splitMessage, truncate, toolLine, markdownToHtml } = require("../formatter");

describe("toolLine", () => {
  it("returns empty string for no tools", () => {
    assert.equal(toolLine([]), "");
  });

  it("formats single tool", () => {
    assert.equal(toolLine(["Read"]), "[Read]");
  });

  it("formats multiple tools", () => {
    assert.equal(toolLine(["Read", "Write", "Bash"]), "[Read, Write, Bash]");
  });
});

describe("truncate", () => {
  it("returns short text unchanged", () => {
    assert.equal(truncate("hello"), "hello");
  });

  it("truncates from the front with ellipsis", () => {
    const long = "x".repeat(5000);
    const result = truncate(long);
    assert.ok(result.startsWith("..."));
    assert.equal(result.length, 4096);
    assert.ok(result.endsWith("x"));
  });

  it("returns text at exact limit unchanged", () => {
    const exact = "a".repeat(4096);
    assert.equal(truncate(exact), exact);
  });
});

describe("splitMessage", () => {
  it("returns single-element array for short text", () => {
    const parts = splitMessage("hello");
    assert.deepEqual(parts, ["hello"]);
  });

  it("splits long text into multiple parts", () => {
    const long = "x".repeat(10000);
    const parts = splitMessage(long);
    assert.ok(parts.length > 1);
    // All parts rejoin to original
    assert.equal(parts.join(""), long);
  });

  it("prefers splitting at newlines", () => {
    // Create text with a newline near the split point
    const firstHalf = "a".repeat(3000);
    const secondHalf = "b".repeat(3000);
    const text = firstHalf + "\n" + secondHalf;
    const parts = splitMessage(text);
    assert.equal(parts.length, 2);
    assert.equal(parts[0], firstHalf);
    assert.equal(parts[1], secondHalf);
  });

  it("falls back to hard split when no good newline found", () => {
    // No newlines at all
    const long = "x".repeat(5000);
    const parts = splitMessage(long);
    assert.equal(parts.length, 2);
    assert.equal(parts[0].length, 4096);
  });
});

describe("markdownToHtml", () => {
  it("returns falsy input unchanged", () => {
    assert.equal(markdownToHtml(""), "");
    assert.equal(markdownToHtml(null), null);
    assert.equal(markdownToHtml(undefined), undefined);
  });

  it("converts bold", () => {
    const result = markdownToHtml("**bold**");
    assert.ok(result.includes("<b>bold</b>"));
  });

  it("converts italic", () => {
    const result = markdownToHtml("*italic*");
    assert.ok(result.includes("<i>italic</i>"));
  });

  it("converts inline code", () => {
    const result = markdownToHtml("`code`");
    assert.ok(result.includes("<code>code</code>"));
  });

  it("converts code blocks with language", () => {
    const result = markdownToHtml("```js\nconsole.log(1)\n```");
    assert.ok(result.includes('<code class="language-js">'));
    assert.ok(result.includes("console.log(1)"));
  });

  it("converts code blocks without language", () => {
    const result = markdownToHtml("```\nhello\n```");
    assert.ok(result.includes("<pre>"));
    assert.ok(result.includes("hello"));
  });

  it("converts headings to bold", () => {
    const result = markdownToHtml("# Title");
    assert.ok(result.includes("<b>Title</b>"));
  });

  it("converts links", () => {
    const result = markdownToHtml("[click](http://example.com)");
    assert.ok(result.includes('<a href="http://example.com">click</a>'));
  });

  it("converts list items with bullet points", () => {
    const result = markdownToHtml("- item1\n- item2");
    assert.ok(result.includes("• item1"));
    assert.ok(result.includes("• item2"));
  });

  it("converts blockquotes", () => {
    const result = markdownToHtml("> quote");
    assert.ok(result.includes("<blockquote>"));
    assert.ok(result.includes("quote"));
  });

  it("converts strikethrough", () => {
    const result = markdownToHtml("~~deleted~~");
    assert.ok(result.includes("<s>deleted</s>"));
  });

  it("converts horizontal rule", () => {
    const result = markdownToHtml("---");
    assert.ok(result.includes("---"));
  });

  it("handles plain text", () => {
    const result = markdownToHtml("just plain text");
    assert.ok(result.includes("just plain text"));
  });
});
