# Telegram Integration

TinyAGI's Telegram client connects to a Telegram bot and routes messages to agents. It supports forum topics (supergroup threads), file exchange, voice transcription, and real-time progress updates.

## Bot Commands

These commands are available in the Telegram `/` menu:

| Command | Description |
|---------|-------------|
| `/agent` | List all available agents |
| `/team` | List all available teams |
| `/context` | Show context window usage (tokens, cost, model) for the current topic's agent |
| `/clear` | Reset the agent session for the current topic (fresh conversation) |
| `/reset @agent_id` | Reset specific agent(s) by name |
| `/restart` | Restart the TinyAGI daemon |

Commands work in both private chats and forum topic threads. In supergroups, commands with `@botname` suffix (e.g. `/context@mybotname`) are supported.

## Agent Routing

Messages are routed to agents in this priority:

1. **Explicit `@agent` prefix** — `@blocklah hey` routes to the blocklah agent
2. **Topic-based routing** — configured in `settings.json` under `channels.telegram.topic_agents`
3. **Default agent** — set per user/topic via `channels.defaults`

When you first message `@agent_id` in a topic, that agent becomes the default for future messages in that topic.

## Voice Transcription

Voice messages are automatically transcribed to text using [faster-whisper](https://github.com/SYSTRAN/faster-whisper) before being sent to agents.

### How it works

1. Telegram client downloads the `.ogg` voice file
2. Sends it to the local whisper transcription service (`http://127.0.0.1:7378/transcribe`)
3. The agent receives both the transcription and the original file:

```
[voice transcription: Hey can you check the deployment status?]
[file: /Users/you/.tinyagi/files/voice_123.ogg]
```

### Whisper service

The whisper service (`scripts/whisper-service.py`) is a Python HTTP microservice that:

- Loads the `small` model with INT8 quantization (~250MB RAM) at startup
- Runs on CPU (Apple Silicon / x86)
- Starts automatically with the Telegram client
- Listens on `127.0.0.1:7378` (configurable via `WHISPER_SERVICE_PORT`)

If the service is unavailable, voice messages fall back to `[voice message - transcription unavailable]` with the file still attached.

### Requirements

- Python 3.9+
- `faster-whisper` pip package (`pip install faster-whisper`)
- ~500MB disk for the `small` model (downloaded on first use)

### Configuration

| Environment variable | Default | Description |
|---------------------|---------|-------------|
| `WHISPER_SERVICE_PORT` | `7378` | Port for the whisper HTTP service |
| `WHISPER_MODEL` | `small` | Model size: `tiny`, `base`, `small`, `medium`, `large-v3` |

## Progress Updates

While agents are working, the Telegram client forwards progress to your chat:

- **Text progress** (e.g. "Let me check the database...") is sent immediately
- **Tool call activity** (file reads, bash commands, etc.) is batched every 30 seconds as a summary message

This lets you see that an agent is actively working even during long silent stretches.

## File Exchange

### Incoming files (user to agent)

Telegram photos, documents, audio, video, voice, video notes, and stickers are downloaded to `~/.tinyagi/files/` and passed to agents as `[file: /path/to/file]` references.

### Outgoing files (agent to user)

Agents can send files by placing them in `~/.tinyagi/files/` and including `[send_file: /absolute/path/to/file]` in their response. The Telegram client detects the file type and sends it as the appropriate Telegram media type (photo, audio, video, or document).

Files are sent to the correct forum topic thread using the `messageThreadId` from the original message.

### Proactive file sending

When agents send files proactively (via the `send-user-message` skill), they must include `--message-thread-id <topic_id>` to ensure files land in the correct Telegram forum topic.

## Context Window (`/context`)

The `/context` command shows the current agent's context window usage:

```
@blocklah - Context Window

Model: claude-opus-4-6[1m]
Context: 434.5K / 1000K tokens
[████████░░░░░░░░░░░░] 43%
Cost: $2.6573
Turns: 5
```

Usage data is persisted to `~/.tinyagi/usage/<agentId>.json` and reset when you use `/clear`.

## Session Management

- `/clear` resets the current topic's agent session (next message starts fresh)
- `/reset @agent1 @agent2` resets specific agents by name
- Both commands clear the usage data so `/context` shows accurate post-reset numbers

## Running Multiple Telegram Bots

You can run a second (or third, etc.) Telegram bot by using TinyAGI's profile system. Each profile gets its own isolated home directory, database, settings, and tmux session.

```bash
# 1. Create a new bot via @BotFather, copy the token

# 2. Start the profile (creates ~/.tinyagi-bot2/ on first run)
tinyagi --profile bot2 start

# 3. Edit the profile env file with the new bot token and unique ports
#    ~/.tinyagi-bot2/profile.env:
TELEGRAM_BOT_TOKEN=123456:ABC-your-second-token
TINYAGI_API_PORT=3778
WHISPER_SERVICE_PORT=7379

# 4. Configure channels/agents for this profile
tinyagi --profile bot2 setup

# 5. Restart to apply
tinyagi --profile bot2 restart
```

Each instance runs completely independently — separate queue, agents, logs, and Telegram polling connection. See [INSTALL.md](INSTALL.md#multi-instance-profiles) for full details.
