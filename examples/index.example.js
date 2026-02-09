const { createBot } = require('./bot-engine');

// The bot will automatically:
// 1. Load environment variables from .env file
// 2. Look for CLAUDE.md in the current working directory
// 3. Use that for project-specific instructions

createBot();
