# TinyClaw CLI Reference

TinyClaw is managed via `./tinyclaw.sh`. All configuration lives in `~/.tinyclaw/settings.json`. The project directory is `/home/ubuntu/tinyclaw`.

## Daemon

```bash
./tinyclaw.sh start       # Start TinyClaw (tmux session with channel clients + queue processor)
./tinyclaw.sh stop        # Stop all processes
./tinyclaw.sh restart     # Stop then start (required after code changes / npm run build)
./tinyclaw.sh status      # Show running status
./tinyclaw.sh attach      # Attach to the tmux session
```

After editing TypeScript source files, always run `npm run build` then `./tinyclaw.sh restart`.

## Messaging

```bash
./tinyclaw.sh send "<message>"          # Send a message to the AI from CLI
./tinyclaw.sh send "@coder fix the bug" # Route to a specific team
./tinyclaw.sh reset                     # Reset conversation (next message starts fresh)
```

## Logs

```bash
./tinyclaw.sh logs              # Show all logs
./tinyclaw.sh logs telegram     # Telegram client logs
./tinyclaw.sh logs queue        # Queue processor logs
./tinyclaw.sh logs heartbeat    # Heartbeat logs
./tinyclaw.sh logs daemon       # Daemon logs
./tinyclaw.sh logs all          # Tail all logs
```

## Provider & Model

```bash
./tinyclaw.sh provider                              # Show current provider and model
./tinyclaw.sh provider anthropic                    # Switch to Anthropic
./tinyclaw.sh provider openai                       # Switch to OpenAI
./tinyclaw.sh provider anthropic --model sonnet     # Switch provider + model together

./tinyclaw.sh model                  # Show current model
./tinyclaw.sh model sonnet           # Anthropic: sonnet or opus
./tinyclaw.sh model gpt-5.3-codex   # OpenAI: gpt-5.3-codex or gpt-5.2
```

Model/provider changes take effect on the next message (no restart needed).

## Teams (Multi-Agent)

Teams let you run multiple AI agents with different models, providers, and system prompts. Messages are routed with `@team_id` prefix.

```bash
./tinyclaw.sh team list            # List all teams
./tinyclaw.sh team add             # Add a new team (interactive)
./tinyclaw.sh team show <id>       # Show team config
./tinyclaw.sh team remove <id>     # Remove a team
./tinyclaw.sh team reset <id>      # Reset a team's conversation
```

Each team gets an isolated workspace directory at `<workspace>/<team_id>/` with its own `.claude/`, `AGENTS.md`, and conversation history.

## Access Control

User/group allowlists per channel. When no allowlist is configured, all users are allowed (default). Once any user or group is added, only those listed are allowed.

```bash
./tinyclaw.sh allowed                          # Show all access control settings
./tinyclaw.sh allow <channel> <user_id>        # Allow a user
./tinyclaw.sh deny <channel> <user_id>         # Remove a user
./tinyclaw.sh allow-group <channel> <group_id> # Allow a group/guild
./tinyclaw.sh deny-group <channel> <group_id>  # Remove a group
```

Valid channels: `telegram`, `whatsapp`, `discord`.

Changes take effect immediately (no restart needed).

## Channel Management

```bash
./tinyclaw.sh channels reset <channel>   # Reset channel auth (e.g. whatsapp QR re-scan)
```

## Setup & Updates

```bash
./tinyclaw.sh setup    # Run setup wizard (channels, provider, model, heartbeat)
./tinyclaw.sh update   # Update TinyClaw to latest version from git
```

## Settings File

All config is in `~/.tinyclaw/settings.json`. Structure:

```json
{
  "channels": {
    "enabled": ["telegram"],
    "telegram": {
      "bot_token": "...",
      "allowed_users": ["123456"],
      "allowed_groups": ["-100789"]
    }
  },
  "models": {
    "provider": "anthropic",
    "anthropic": { "model": "opus" }
  },
  "teams": {
    "coder": {
      "name": "Code Assistant",
      "provider": "anthropic",
      "model": "sonnet",
      "working_directory": "/path/to/workspace/coder"
    }
  }
}
```

## Key Paths

| Path | Purpose |
|------|---------|
| `/home/ubuntu/tinyclaw/` | Project root (source code) |
| `~/.tinyclaw/settings.json` | All configuration |
| `~/.tinyclaw/queue/incoming/` | Incoming message queue |
| `~/.tinyclaw/queue/outgoing/` | Outgoing response queue |
| `~/.tinyclaw/logs/` | All log files |
| `~/.tinyclaw/files/` | Uploaded files from channels |
