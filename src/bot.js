const TelegramBot = require("node-telegram-bot-api");
const { runClaude } = require("./claude");
const sessions = require("./sessions");
const { splitMessage, truncate, toolLine, markdownToHtml } = require("./formatter");
const config = require("./config");
const { downloadBuffer, transcribeAudio } = require("./transcribe");
const { autoCommit } = require("./git");
const { execSync } = require("child_process");

function createBot() {
  const bot = new TelegramBot(config.telegramToken, { polling: true });

  let botInfo = null;
  bot.getMe().then((me) => {
    botInfo = me;
    console.log("[bot] bot username:", me.username, "id:", me.id);

    // Register commands for the command menu
    const commands = [
      { command: "start", description: "Start a Claude session" },
      { command: "clear", description: "Start a new conversation" },
      { command: "cost", description: "Show session cost" },
      { command: "sonnet", description: "Switch to Claude Sonnet" },
      { command: "haiku", description: "Switch to Claude Haiku" },
      { command: "opus", description: "Switch to Claude Opus" },
      { command: "status", description: "Show git status" },
      { command: "help", description: "Show help message" },
    ];
    bot.setMyCommands(commands).catch((err) => {
      console.error("[bot] failed to set commands:", err.message);
    });
  });

  // ── Message handler ───────────────────────────────────────

  bot.on("message", (msg) => {
    // Whitelist check
    if (config.allowedUserIds.length > 0 && !config.allowedUserIds.includes(msg.from?.id)) {
      console.log("[bot] blocked user", msg.from?.id, msg.from?.username);
      return;
    }

    console.log(
      "[bot] message from chat",
      msg.chat.id,
      "user",
      msg.from?.username || msg.from?.id,
      ":",
      (msg.text || "").slice(0, 80),
    );

    // ── Voice message handling ─────────────────────────────
    if (msg.voice) {
      const chatId = msg.chat.id;
      const isGroup = msg.chat.type === "group" || msg.chat.type === "supergroup";
      if (isGroup && !config.respondToAllGroupMessages) {
        if (!botInfo) return;
        const isReply = msg.reply_to_message?.from?.id === botInfo.id;
        if (!isReply) return;
      }
      console.log(
        "[bot] voice message received [chat %d] duration: %ds file_id: %s",
        chatId,
        msg.voice.duration,
        msg.voice.file_id,
      );
      const username = msg.from?.username || msg.from?.first_name || String(msg.from?.id);
      enqueue(chatId, () => handleVoiceMessage(bot, chatId, msg, username));
      return;
    }

    if (!msg.text) return;

    const chatId = msg.chat.id;
    const isGroup = msg.chat.type === "group" || msg.chat.type === "supergroup";

    // In groups, only respond when mentioned or replied to (unless configured otherwise)
    if (isGroup && !config.respondToAllGroupMessages) {
      if (!botInfo) return;
      const isMentioned = msg.text.includes(`@${botInfo.username}`);
      const isReply = msg.reply_to_message?.from?.id === botInfo.id;
      if (!isMentioned && !isReply) return;
    }

    // Strip @mention from the text before processing
    let text = msg.text;
    if (botInfo) {
      text = text.replace(new RegExp(`@${botInfo.username}`, "gi"), "").trim();
    }

    // ── Commands (checked after stripping mention) ──────────
    if (/^\/clear(@\w+)?$/.test(text)) {
      console.log("[bot] /clear from chat", chatId);
      sessions.clear(chatId);
      bot.sendMessage(chatId, "Session cleared. Next message starts fresh.");
      return;
    }
    if (/^\/cost(@\w+)?$/.test(text)) {
      const cost = sessions.getCost(chatId);
      bot.sendMessage(chatId, `Session cost so far: $${cost.toFixed(4)}`);
      return;
    }
    if (/^\/help(@\w+)?$/.test(text)) {
      const session = sessions.get(chatId);
      const model = sessions.getModel(chatId) || "haiku";
      const cost = sessions.getCost(chatId);
      const sessionInfo = session?.sessionId
        ? `Session ID: ${session.sessionId.slice(0, 8)}...`
        : "No active session";

      bot.sendMessage(
        chatId,
        [
          "📋 Commands:",
          "/start   – Start a Claude session",
          "/clear   – Start a new conversation",
          "/cost    – Show session cost",
          "/sonnet  – Switch to Claude Sonnet",
          "/haiku   – Switch to Claude Haiku",
          "/opus    – Switch to Claude Opus",
          "/status  – Show git status",
          "/help    – Show this message",
          "",
          "📊 Session Information:",
          `Current Model: ${model}`,
          `Total Cost: $${cost.toFixed(4)}`,
          sessionInfo,
          "",
          "Everything else is sent to Claude.",
        ].join("\n"),
      );
      return;
    }
    if (/^\/start(@\w+)?$/.test(text)) {
      bot.sendMessage(chatId, "Send any message to start a Claude session.");
      return;
    }
    if (/^\/status(@\w+)?$/.test(text)) {
      console.log("[bot] /status from chat", chatId);
      handleGitStatus(bot, chatId);
      return;
    }
    if (/^\/(sonnet|haiku|opus)(@\w+)?$/.test(text)) {
      const model = text.match(/^\/(sonnet|haiku|opus)/)[1];
      sessions.setModel(chatId, model);
      bot.sendMessage(chatId, `Model switched to ${model}.`);
      return;
    }

    const username = msg.from?.username || msg.from?.first_name || String(msg.from?.id);
    enqueue(chatId, () => handleMessage(bot, chatId, text, username));
  });

  bot.on("polling_error", (err) => {
    console.error("[bot] polling error:", err.message);
  });

  console.log("[bot] listening for messages...");
  return bot;
}

// ── Queue ─────────────────────────────────────────────────

const queues = new Map();

function enqueue(chatId, fn) {
  const prev = queues.get(chatId) || Promise.resolve();
  const next = prev.then(fn).catch((err) => {
    console.error(`[bot] queue error [chat ${chatId}]:`, err);
  });
  queues.set(chatId, next);
}

// ── Core handler ──────────────────────────────────────────

async function handleMessage(bot, chatId, text, username) {
  console.log("[bot] handling message for chat", chatId);

  const session = sessions.get(chatId);
  const sessionId = session?.sessionId || null;
  const isContinuation = sessionId !== null;
  const previousCost = sessions.getCost(chatId);
  console.log("[bot] session:", sessionId || "(new)");

  const placeholder = await bot.sendMessage(chatId, "...");
  const msgId = placeholder.message_id;
  console.log("[bot] placeholder sent, msgId:", msgId);

  let lastEdit = "";
  let lastEditTime = 0;
  let tools = new Set();

  function throttledEdit(content) {
    const display = truncate(content);
    if (display === lastEdit) return;
    const now = Date.now();
    if (now - lastEditTime < config.editInterval) return;
    lastEdit = display;
    lastEditTime = now;
    console.log("[bot] editing message:", display.slice(0, 80));
    const html = markdownToHtml(display);
    bot
      .editMessageText(html, { chat_id: chatId, message_id: msgId, parse_mode: "HTML" })
      .catch((e) => {
        // Fallback: send without parse_mode if HTML is malformed
        bot
          .editMessageText(display, { chat_id: chatId, message_id: msgId })
          .catch((e2) => console.error("[bot] edit fallback error:", e2.message));
      });
  }

  console.log("[bot] calling runClaude...");

  const model = sessions.getModel(chatId);
  const result = await runClaude(text, sessionId, {
    model,
    onText: (partial) => {
      let display = partial;
      if (tools.size) display = toolLine([...tools]) + "\n\n" + display;
      throttledEdit(display);
    },
    onTool: (names) => {
      names.forEach((n) => tools.add(n));
      throttledEdit(toolLine([...tools]) + " ...");
    },
  });

  console.log(
    "[bot] runClaude done. isError:",
    result.isError,
    "sessionId:",
    result.sessionId,
    "text length:",
    result.text?.length,
  );

  // Persist session
  if (result.sessionId) {
    sessions.set(chatId, result.sessionId, result.cost);
  }

  // Send final response
  const finalText = result.text || "(empty response)";
  const htmlText = markdownToHtml(finalText);
  const parts = splitMessage(htmlText);
  console.log("[bot] sending", parts.length, "message parts");

  await bot
    .editMessageText(parts[0], { chat_id: chatId, message_id: msgId, parse_mode: "HTML" })
    .catch(async (e) => {
      if (e.message.includes("message is not modified")) return;
      console.error("[bot] final edit error (HTML):", e.message);
      // Fallback: retry without parse_mode
      const plainParts = splitMessage(finalText);
      await bot
        .editMessageText(plainParts[0], { chat_id: chatId, message_id: msgId })
        .catch((e2) => console.error("[bot] final edit fallback error:", e2.message));
    });

  for (let i = 1; i < parts.length; i++) {
    await bot.sendMessage(chatId, parts[i], { parse_mode: "HTML" }).catch(async (e) => {
      console.error("[bot] send part error (HTML):", e.message);
      // Fallback: retry without parse_mode
      const plainParts = splitMessage(finalText);
      if (plainParts[i]) {
        await bot.sendMessage(chatId, plainParts[i]).catch((e2) => {
          console.error("[bot] send part fallback error:", e2.message);
        });
      }
    });
  }

  // Auto-commit and push changes
  const currentCost = result.cost || 0;
  const totalCost = previousCost + currentCost;
  autoCommit({
    projectDir: process.cwd(),
    messageText: text,
    username: username || "unknown",
    cost: currentCost,
    totalCost,
    isContinuation,
  });

  console.log("[bot] done handling chat", chatId);
}

// ── Voice handler ────────────────────────────────────────

async function handleVoiceMessage(bot, chatId, msg, username) {
  const placeholder = await bot.sendMessage(chatId, "Transcribing voice message...");
  const msgId = placeholder.message_id;

  try {
    const fileLink = await bot.getFileLink(msg.voice.file_id);
    console.log("[bot] voice file link:", fileLink);

    const buffer = await downloadBuffer(fileLink);
    console.log("[bot] downloaded voice: %d bytes", buffer.length);

    const transcription = await transcribeAudio(buffer, "voice.ogg");
    console.log("[bot] transcription:", transcription.slice(0, 120));

    if (!transcription.trim()) {
      await bot
        .editMessageText("(empty transcription - no speech detected)", {
          chat_id: chatId,
          message_id: msgId,
        })
        .catch((e) => console.error("[bot] edit error:", e.message));
      return;
    }

    await bot
      .editMessageText(`🎤 "${transcription}"`, {
        chat_id: chatId,
        message_id: msgId,
      })
      .catch((e) => console.error("[bot] edit error:", e.message));

    await handleMessage(bot, chatId, transcription, username);
  } catch (err) {
    console.error("[bot] voice transcription error:", err);
    await bot
      .editMessageText(`Could not transcribe voice message: ${err.message}`, {
        chat_id: chatId,
        message_id: msgId,
      })
      .catch((e) => console.error("[bot] edit error:", e.message));
  }
}

// ── Git status handler ────────────────────────────────────

function handleGitStatus(bot, chatId) {
  try {
    const cwd = process.cwd();
    const status = execSync("git status --short", { cwd, encoding: "utf8" }).trim();
    const log = execSync("git log --oneline -10", { cwd, encoding: "utf8" }).trim();

    const lines = ["📂 Git Status"];
    if (status) {
      lines.push("", "Changes:", status);
    } else {
      lines.push("", "Working tree clean.");
    }
    lines.push("", "Recent commits:", log);

    bot.sendMessage(chatId, lines.join("\n"));
  } catch (err) {
    console.error("[bot] git status error:", err.message);
    bot.sendMessage(chatId, `Git status error: ${err.message}`);
  }
}

module.exports = { createBot };
