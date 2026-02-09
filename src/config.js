require('dotenv').config();

module.exports = {
  telegramToken: process.env.TELEGRAM_TOKEN,
  openaiApiKey: process.env.OPENAI_API_KEY,

  // Minimum ms between Telegram message edits (avoids rate limits)
  editInterval: 2000,

  // Telegram message character limit
  maxMessageLength: 4096,
};
