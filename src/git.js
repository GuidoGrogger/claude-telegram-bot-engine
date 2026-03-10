const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

/**
 * Auto-commit and push changes after a message is processed.
 * Only commits the project directory (not the bot-engine submodule).
 *
 * @param {object} opts
 * @param {string} opts.projectDir   - Absolute path to the project root
 * @param {string} opts.messageText  - The chat message (text or transcription)
 * @param {string} opts.username     - Telegram username
 * @param {number} opts.cost         - Cost of this Claude call (USD)
 * @param {number} opts.totalCost    - Cumulative session cost (USD)
 * @param {boolean} opts.isContinuation - Whether this is a follow-up in the same session
 */
function autoCommit({ projectDir, messageText, username, cost, totalCost, isContinuation }) {
  // Build commit message (full message, no truncation)
  let commitMsg;
  if (isContinuation) {
    commitMsg =
      `[Bot/Fortsetzung] @${username}: "${messageText}"\n\n` +
      `Neue Kosten: $${cost.toFixed(4)} | Gesamt: $${totalCost.toFixed(4)}`;
  } else {
    commitMsg =
      `[Bot] @${username}: "${messageText}"\n\n` +
      `Kosten: $${cost.toFixed(4)}`;
  }

  try {
    // Commit project directory (excludes bot-engine submodule changes)
    const projectChanged = hasChanges(projectDir);
    if (projectChanged) {
      console.log("[git] changes detected in project, committing...");
      execSync("git add -A", { cwd: projectDir });
      gitCommit(commitMsg, projectDir);
      execSync("git push", { cwd: projectDir });
      console.log("[git] project committed and pushed");
    } else {
      console.log("[git] no changes to commit");
    }
  } catch (err) {
    console.error("[git] auto-commit error:", err.message);
  }
}

/**
 * Commit using a temp file to avoid shell escaping issues with special chars and newlines.
 */
function gitCommit(message, cwd) {
  const tmpFile = path.join(os.tmpdir(), `commit-msg-${Date.now()}.txt`);
  try {
    fs.writeFileSync(tmpFile, message, "utf8");
    execSync(`git commit -F ${tmpFile}`, { cwd });
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

function hasChanges(dir) {
  try {
    const status = execSync("git status --porcelain", { cwd: dir, encoding: "utf8" });
    return status.trim().length > 0;
  } catch {
    return false;
  }
}

module.exports = { autoCommit };
