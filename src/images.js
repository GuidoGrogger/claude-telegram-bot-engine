const fs = require("fs");
const os = require("os");
const path = require("path");
const { downloadBuffer } = require("./transcribe");

const TEMP_DIR = path.join(os.tmpdir(), "telegram-images");

function ensureTempDir() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
}

function getBestPhoto(photoSizes) {
  if (!Array.isArray(photoSizes) || photoSizes.length === 0) return null;
  return photoSizes[photoSizes.length - 1];
}

async function downloadPhoto(bot, fileId) {
  ensureTempDir();
  const fileLink = await bot.getFileLink(fileId);
  const buffer = await downloadBuffer(fileLink);

  const ext = path.extname(new URL(fileLink).pathname) || ".jpg";
  const filename = `${fileId}${ext}`;
  const filePath = path.join(TEMP_DIR, filename);

  fs.writeFileSync(filePath, buffer);
  console.log("[images] saved %d bytes to %s", buffer.length, filePath);
  return filePath;
}

async function downloadPhotos(bot, fileIds) {
  const paths = [];
  for (const fileId of fileIds) {
    const p = await downloadPhoto(bot, fileId);
    paths.push(p);
  }
  return paths;
}

function cleanupImages(filePaths) {
  for (const p of filePaths) {
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch (e) {
      console.error("[images] cleanup error:", e.message);
    }
  }
}

function buildImagePrompt(text, imagePaths) {
  if (!imagePaths || imagePaths.length === 0) return text;

  const fileList = imagePaths.map((p) => `- ${p}`).join("\n");
  const parts = [
    `[The user sent ${imagePaths.length} image(s). Read each image file to see its content before responding.]`,
    "",
    "Image files:",
    fileList,
  ];

  if (text) {
    parts.push("", "User message:", text);
  }

  return parts.join("\n");
}

module.exports = {
  getBestPhoto,
  downloadPhoto,
  downloadPhotos,
  cleanupImages,
  buildImagePrompt,
  TEMP_DIR,
};
