const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { getBestPhoto, buildImagePrompt, cleanupImages, TEMP_DIR } = require("../images");

describe("getBestPhoto", () => {
  it("returns the largest photo (last element)", () => {
    const sizes = [
      { file_id: "small", width: 90, height: 90 },
      { file_id: "medium", width: 320, height: 320 },
      { file_id: "large", width: 800, height: 800 },
    ];
    const best = getBestPhoto(sizes);
    assert.equal(best.file_id, "large");
  });

  it("returns single photo from array of one", () => {
    const sizes = [{ file_id: "only", width: 200, height: 200 }];
    assert.equal(getBestPhoto(sizes).file_id, "only");
  });

  it("returns null for empty array", () => {
    assert.equal(getBestPhoto([]), null);
  });

  it("returns null for non-array input", () => {
    assert.equal(getBestPhoto(null), null);
    assert.equal(getBestPhoto(undefined), null);
  });
});

describe("buildImagePrompt", () => {
  it("returns original text when no images", () => {
    assert.equal(buildImagePrompt("hello", []), "hello");
    assert.equal(buildImagePrompt("hello", null), "hello");
    assert.equal(buildImagePrompt("hello", undefined), "hello");
  });

  it("builds prompt with single image and text", () => {
    const result = buildImagePrompt("What is this?", ["/tmp/img.jpg"]);
    assert.ok(result.includes("1 image(s)"));
    assert.ok(result.includes("/tmp/img.jpg"));
    assert.ok(result.includes("What is this?"));
    assert.ok(result.includes("User message:"));
  });

  it("builds prompt with multiple images and text", () => {
    const result = buildImagePrompt("Describe these", ["/tmp/a.jpg", "/tmp/b.png"]);
    assert.ok(result.includes("2 image(s)"));
    assert.ok(result.includes("/tmp/a.jpg"));
    assert.ok(result.includes("/tmp/b.png"));
    assert.ok(result.includes("Describe these"));
  });

  it("builds prompt with images but no text", () => {
    const result = buildImagePrompt("", ["/tmp/img.jpg"]);
    assert.ok(result.includes("1 image(s)"));
    assert.ok(result.includes("/tmp/img.jpg"));
    assert.ok(!result.includes("User message:"));
  });

  it("includes instruction to read image files", () => {
    const result = buildImagePrompt("test", ["/tmp/img.jpg"]);
    assert.ok(result.includes("Read each image file"));
  });
});

describe("cleanupImages", () => {
  const testDir = path.join(TEMP_DIR, "test-cleanup");

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {}
  });

  it("removes existing files", () => {
    const filePath = path.join(testDir, "test.jpg");
    fs.writeFileSync(filePath, "test data");
    assert.ok(fs.existsSync(filePath));

    cleanupImages([filePath]);
    assert.ok(!fs.existsSync(filePath));
  });

  it("does not throw for non-existent files", () => {
    assert.doesNotThrow(() => {
      cleanupImages(["/tmp/does-not-exist-12345.jpg"]);
    });
  });

  it("handles empty array", () => {
    assert.doesNotThrow(() => {
      cleanupImages([]);
    });
  });
});
