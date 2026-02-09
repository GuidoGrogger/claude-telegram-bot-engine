require('dotenv').config();

module.exports = {
  telegramToken: process.env.TELEGRAM_TOKEN,
  openaiApiKey: process.env.OPENAI_API_KEY,

  // Respond to all messages in group chats (not just mentions/replies)
  respondToAllGroupMessages: process.env.RESPOND_TO_ALL_GROUP_MESSAGES === 'true',

  // Minimum ms between Telegram message edits (avoids rate limits)
  editInterval: 2000,

  // Telegram message character limit
  maxMessageLength: 4096,
};
