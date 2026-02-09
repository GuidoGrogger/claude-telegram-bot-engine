# Claude Telegram Bot Engine

Reusable Telegram bot engine for integrating Claude Code sessions via Telegram messages.

## Features

- Interactive Claude Code sessions via Telegram
- Voice message transcription
- Session management with cost tracking
- Support for multiple Claude models (Sonnet, Haiku, Opus)
- Markdown formatting in responses
- Group chat support with mention/reply detection

## Prerequisites

Before getting started, ensure you have:

1. **Claude Code installed**:
   ```bash
   npm install -g claude
   ```

2. **Accept Claude Code terms** (run once):
   ```bash
   claude --dangerously-skip-permissions
   ```

## Installation

### As a Git Submodule (Recommended)

```bash
cd your-project
git submodule add https://github.com/GuidoGrogger/claude-telegram-bot-engine.git bot-engine
cd bot-engine
npm install
```

### Standalone

```bash
git clone https://github.com/GuidoGrogger/claude-telegram-bot-engine.git
cd claude-telegram-bot-engine
npm install
```

## Usage

### Basic Setup

1. Create a `.env` file with your credentials:

```env
TELEGRAM_TOKEN=your_telegram_bot_token
OPENAI_API_KEY=your_openai_api_key
```

2. Create an `index.js` in your project root:

```javascript
const { createBot } = require('./bot-engine');

createBot();
```

#### Shell script
```bash
mkdir my-new-project
cd my-new-project
git init
git submodule add git@github.com:GuidoGrogger/claude-telegram-bot-engine.git bot-engine
cd bot-engine && npm install && cd ..

# Create index.js
echo "const { createBot } = require('./bot-engine');" > index.js
echo "createBot();" >> index.js

# Copy .env and create CLAUDE.md
cp ../thailand/.env.example .env
# Edit .env with your tokens
# Create CLAUDE.md with project-specific instructions

# Run the bot
node index.js
```

3. **Important**: Run the bot from the directory containing your `CLAUDE.md` file. The bot will automatically load project-specific instructions from `CLAUDE.md` when starting Claude Code sessions.

```bash
# Run from your project root (where CLAUDE.md lives)
node index.js
```

### Directory Structure

Your project should look like this:

```
your-project/
├── bot-engine/          # Git submodule (this engine)
├── index.js             # Your entry point
├── .env                 # Credentials
├── CLAUDE.md            # Project-specific instructions for Claude
└── memory/              # Optional: data directory for your project
```

### CLAUDE.md

The bot automatically loads instructions from a `CLAUDE.md` file in the working directory. This file should contain project-specific context and instructions for Claude Code.

Example `CLAUDE.md`:

```markdown
# Claude Instructions for my-project

You are assisting with [project description].

## Guidelines
- [Instruction 1]
- [Instruction 2]

## Directory Structure
[Your project structure]
```

## Configuration

The engine uses environment variables from `.env`:

- `TELEGRAM_TOKEN` - Your Telegram bot token (required)
- `OPENAI_API_KEY` - Your OpenAI API key for transcription (required)

Additional settings are configured in `src/config.js`:
- `editInterval`: Minimum ms between message edits (default: 2000)
- `maxMessageLength`: Telegram message character limit (default: 4096)

## Bot Commands

- `/start` - Start a Claude session
- `/clear` - Start a new conversation
- `/cost` - Show session cost
- `/sonnet` - Switch to Claude Sonnet
- `/haiku` - Switch to Claude Haiku
- `/opus` - Switch to Claude Opus
- `/help` - Show help message

## Running as a Service

Example systemd service file:

```ini
[Unit]
Description=Claude Telegram Bot
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/your-project
ExecStart=/usr/bin/node /path/to/your-project/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

## Development

### Project Structure

```
bot-engine/
├── src/
│   ├── bot.js         # Core bot logic
│   ├── claude.js      # Claude API interactions
│   ├── sessions.js    # Session management
│   ├── config.js      # Configuration
│   ├── transcribe.js  # Voice transcription
│   └── formatter.js   # Message formatting
├── index.js           # Entry point
└── package.json       # Dependencies
```

## License

MIT
