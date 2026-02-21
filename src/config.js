require('dotenv').config();

// Parse comma-separated list of allowed Telegram user IDs (numbers)
// e.g. ALLOWED_USER_IDS=123456789,987654321
const allowedUserIds = process.env.ALLOWED_USER_IDS
  ? process.env.ALLOWED_USER_IDS.split(',').map(id => parseInt(id.trim(), 10)).filter(Boolean)
  : [];

module.exports = {
  telegramToken: process.env.TELEGRAM_TOKEN,
  openaiApiKey: process.env.OPENAI_API_KEY,

  // Whitelist: only these Telegram user IDs can use the bot (empty = allow all)
  allowedUserIds,

  // Respond to all messages in group chats (not just mentions/replies)
  respondToAllGroupMessages: process.env.RESPOND_TO_ALL_GROUP_MESSAGES === 'true',

  // Minimum ms between Telegram message edits (avoids rate limits)
  editInterval: 2000,

  // Telegram message character limit
  maxMessageLength: 4096,
};
