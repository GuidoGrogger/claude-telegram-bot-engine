const TelegramBot = require("node-telegram-bot-api");
const config = require("./config");
const { getAITool } = require("./ai-tool-factory");
const { runAITool } = getAITool();
const sessions = require("./sessions");
const { splitMessage, truncate, toolLine, markdownToHtml } = require("./formatter");
const { downloadBuffer, transcribeAudio } = require("./transcribe");
const { autoCommit } = require("./git");
const { execSync } = require("child_process");
const { getBestPhoto, downloadPhotos, cleanupImages } = require("./images");

function createBot() {
  const bot = new TelegramBot(config.telegramToken, { polling: true });

  let botInfo = null;
  bot.getMe().then((me) => {
    botInfo = me;
    console.log("[bot] bot username:", me.username, "id:", me.id);

    // Register commands for the command menu
    const commands = [
      { command: "clear", description: "Start a new conversation" },
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
      (msg.text || msg.caption || "").slice(0, 80),
      msg.photo ? `[${msg.photo.length} photo size(s)]` : "",
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

    // ── Photo message handling ─────────────────────────────
    if (msg.photo) {
      const chatId = msg.chat.id;
      const isGroup = msg.chat.type === "group" || msg.chat.type === "supergroup";
      if (isGroup && !config.respondToAllGroupMessages) {
        if (!botInfo) return;
        const isReply = msg.reply_to_message?.from?.id === botInfo.id;
        if (!isReply) return;
      }

      const best = getBestPhoto(msg.photo);
      if (!best) return;

      const username = msg.from?.username || msg.from?.first_name || String(msg.from?.id);
      const caption = msg.caption || "";

      // Strip @mention from caption
      let text = caption;
      if (botInfo) {
        text = text.replace(new RegExp(`@${botInfo.username}`, "gi"), "").trim();
      }

      if (msg.media_group_id) {
        // Part of a media group — batch photos together
        handleMediaGroup(bot, msg.media_group_id, chatId, best.file_id, text, username);
      } else {
        // Single photo
        console.log("[bot] single photo received [chat %d] file_id: %s", chatId, best.file_id);
        enqueue(chatId, () => handlePhotoMessage(bot, chatId, [best.file_id], text, username));
      }
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
      const oldImages = sessions.clear(chatId);
      cleanupImages(oldImages);
      bot.sendMessage(chatId, "Session cleared. Next message starts fresh.");
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

async function handleMessage(bot, chatId, text, username, images) {
  console.log("[bot] handling message for chat", chatId);

  const session = sessions.get(chatId);
  const sessionId = session?.sessionId || null;
  const isContinuation = sessionId !== null;
  const previousCost = sessions.getCost(chatId);
  console.log("[bot] session:", sessionId || "(new)");

  // Store new images in session so they persist (files stay on disk until /clear)
  if (images?.length) {
    sessions.addImages(chatId, images);
  }

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

  console.log("[bot] calling AI tool...");

  const model = sessions.getModel(chatId);
  const result = await runAITool(text, sessionId, {
    model,
    images,
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
    "[bot] AI tool done. isError:",
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
  const commitText = images?.length ? `[${images.length} image(s)] ${text}` : text;
  autoCommit({
    projectDir: process.cwd(),
    messageText: commitText,
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

// ── Photo handler ─────────────────────────────────────────

const mediaGroups = new Map();
const MEDIA_GROUP_DELAY = 500;

function handleMediaGroup(bot, groupId, chatId, fileId, caption, username) {
  let group = mediaGroups.get(groupId);
  if (!group) {
    group = { chatId, username, caption: "", fileIds: [], timer: null };
    mediaGroups.set(groupId, group);
  }
  group.fileIds.push(fileId);
  if (caption) group.caption = caption;

  clearTimeout(group.timer);
  group.timer = setTimeout(() => {
    mediaGroups.delete(groupId);
    console.log(
      "[bot] media group %s complete: %d photos [chat %d]",
      groupId,
      group.fileIds.length,
      group.chatId,
    );
    enqueue(group.chatId, () =>
      handlePhotoMessage(bot, group.chatId, group.fileIds, group.caption, group.username),
    );
  }, MEDIA_GROUP_DELAY);
}

async function handlePhotoMessage(bot, chatId, fileIds, text, username) {
  const placeholder = await bot.sendMessage(chatId, "Processing image(s)...");
  const msgId = placeholder.message_id;

  let imagePaths = [];
  try {
    imagePaths = await downloadPhotos(bot, fileIds);
    console.log("[bot] downloaded %d photo(s) for chat %d", imagePaths.length, chatId);

    await bot
      .editMessageText(`Processing ${imagePaths.length} image(s)...`, {
        chat_id: chatId,
        message_id: msgId,
      })
      .catch(() => {});

    await handleMessage(bot, chatId, text || "", username, imagePaths);

    // Delete the "Processing" placeholder (handleMessage sends its own)
    await bot.deleteMessage(chatId, msgId).catch(() => {});
  } catch (err) {
    console.error("[bot] photo processing error:", err);
    await bot
      .editMessageText(`Could not process image(s): ${err.message}`, {
        chat_id: chatId,
        message_id: msgId,
      })
      .catch((e) => console.error("[bot] edit error:", e.message));
  } finally {
    // Images are now managed by the session and cleaned up on /clear
    // Only cleanup if handleMessage failed before images could be added to session
    if (imagePaths.length > 0) {
      const sessionImages = sessions.getImages(chatId);
      const orphaned = imagePaths.filter((p) => !sessionImages.includes(p));
      if (orphaned.length > 0) cleanupImages(orphaned);
    }
  }
}


module.exports = { createBot };
