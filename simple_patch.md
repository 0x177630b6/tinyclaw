# TinyClaw — User Access, Default Agent, & Settings Patch

**Goal:** Cherry-pick ONLY the user rights, default-agent-per-channel, and settings
features from `feat/user-access` into `main`, without bringing over the agent→team
rename, heartbeat changes, file moves, module inlining, or visualizer removal.

> These changes are backwards-compatible — if no allowlist is configured, all users
> are allowed (same behaviour as today).

---

## What This Patch Adds

| Feature | Description |
|---------|-------------|
| **User allowlist** | `allow / deny` a user ID per channel (telegram/whatsapp/discord) |
| **Group allowlist** | `allow-group / deny-group` a group/guild ID per channel |
| **Default team per channel** | Route all un-prefixed messages on a channel to a specific agent/team |
| **`allowed` command** | List all current access control settings |
| **`default-team` command** | Show / set / clear default team bindings |
| **Runtime enforcement** | Each channel client checks the allowlist before processing messages |
| **Queue-processor routing** | Falls back to channel `default_team` when no `@agent` prefix is used |

---

## Files Changed (7 files)

| File | Action |
|------|--------|
| `lib/access.sh` | **NEW** — 136 lines, entire file |
| `tinyclaw.sh` | **PATCH** — add source + 6 CLI commands + help text |
| `lib/teams.sh` | **PATCH** — append `team_reset()` function |
| `src/channels/telegram-client.ts` | **PATCH** — add access control functions + enforce in handler |
| `src/channels/whatsapp-client.ts` | **PATCH** — add access control functions + enforce in handler |
| `src/channels/discord-client.ts` | **PATCH** — add access control functions + enforce in handler |
| `src/queue-processor.ts` | **PATCH** — add default-team fallback routing (6 lines) |

---

## 1. Create `lib/access.sh` (NEW FILE)

```bash
#!/usr/bin/env bash
# Access control helpers for TinyClaw
# Manages allowed_users / allowed_groups per channel in settings.json

VALID_CHANNELS=("telegram" "whatsapp" "discord")

_validate_channel() {
    local channel="$1"
    for c in "${VALID_CHANNELS[@]}"; do
        if [ "$c" = "$channel" ]; then
            return 0
        fi
    done
    echo -e "${RED}Invalid channel: $channel${NC}"
    echo "Valid channels: ${VALID_CHANNELS[*]}"
    return 1
}

_ensure_settings() {
    if [ ! -f "$SETTINGS_FILE" ]; then
        echo -e "${RED}No settings file found. Run setup first.${NC}"
        exit 1
    fi
}

access_allow_user() {
    local channel="$1"
    local user_id="$2"
    _validate_channel "$channel" || exit 1
    _ensure_settings

    local tmp_file="$SETTINGS_FILE.tmp"
    jq --arg ch "$channel" --arg uid "$user_id" '
        .channels[$ch].allowed_users = ((.channels[$ch].allowed_users // []) + [$uid] | unique)
    ' "$SETTINGS_FILE" > "$tmp_file" && mv "$tmp_file" "$SETTINGS_FILE"

    echo -e "${GREEN}Allowed user $user_id on $channel${NC}"
}

access_deny_user() {
    local channel="$1"
    local user_id="$2"
    _validate_channel "$channel" || exit 1
    _ensure_settings

    local tmp_file="$SETTINGS_FILE.tmp"
    jq --arg ch "$channel" --arg uid "$user_id" '
        .channels[$ch].allowed_users = ((.channels[$ch].allowed_users // []) | map(select(. != $uid)))
    ' "$SETTINGS_FILE" > "$tmp_file" && mv "$tmp_file" "$SETTINGS_FILE"

    echo -e "${GREEN}Denied user $user_id on $channel${NC}"
}

access_allow_group() {
    local channel="$1"
    local group_id="$2"
    _validate_channel "$channel" || exit 1
    _ensure_settings

    local tmp_file="$SETTINGS_FILE.tmp"
    jq --arg ch "$channel" --arg gid "$group_id" '
        .channels[$ch].allowed_groups = ((.channels[$ch].allowed_groups // []) + [$gid] | unique)
    ' "$SETTINGS_FILE" > "$tmp_file" && mv "$tmp_file" "$SETTINGS_FILE"

    echo -e "${GREEN}Allowed group $group_id on $channel${NC}"
}

access_deny_group() {
    local channel="$1"
    local group_id="$2"
    _validate_channel "$channel" || exit 1
    _ensure_settings

    local tmp_file="$SETTINGS_FILE.tmp"
    jq --arg ch "$channel" --arg gid "$group_id" '
        .channels[$ch].allowed_groups = ((.channels[$ch].allowed_groups // []) | map(select(. != $gid)))
    ' "$SETTINGS_FILE" > "$tmp_file" && mv "$tmp_file" "$SETTINGS_FILE"

    echo -e "${GREEN}Denied group $group_id on $channel${NC}"
}

access_set_default_team() {
    local channel="$1"
    local team_id="$2"
    _validate_channel "$channel" || exit 1
    _ensure_settings

    local tmp_file="$SETTINGS_FILE.tmp"
    jq --arg ch "$channel" --arg tid "$team_id" '
        .channels[$ch].default_team = $tid
    ' "$SETTINGS_FILE" > "$tmp_file" && mv "$tmp_file" "$SETTINGS_FILE"

    echo -e "${GREEN}Default team for $channel set to: $team_id${NC}"
}

access_clear_default_team() {
    local channel="$1"
    _validate_channel "$channel" || exit 1
    _ensure_settings

    local tmp_file="$SETTINGS_FILE.tmp"
    jq --arg ch "$channel" '
        .channels[$ch] |= del(.default_team)
    ' "$SETTINGS_FILE" > "$tmp_file" && mv "$tmp_file" "$SETTINGS_FILE"

    echo -e "${GREEN}Default team for $channel cleared${NC}"
}

access_list() {
    _ensure_settings

    echo -e "${BLUE}Access Control Settings${NC}"
    echo ""
    for channel in "${VALID_CHANNELS[@]}"; do
        echo -e "${YELLOW}$channel:${NC}"
        local users groups default_team
        users=$(jq -r ".channels.$channel.allowed_users // [] | .[]" "$SETTINGS_FILE" 2>/dev/null)
        groups=$(jq -r ".channels.$channel.allowed_groups // [] | .[]" "$SETTINGS_FILE" 2>/dev/null)
        default_team=$(jq -r ".channels.$channel.default_team // empty" "$SETTINGS_FILE" 2>/dev/null)
        if [ -n "$default_team" ]; then
            echo "  Default team: $default_team"
        fi
        if [ -z "$users" ] && [ -z "$groups" ]; then
            echo "  (no restrictions - all users allowed)"
        else
            if [ -n "$users" ]; then
                echo "  Allowed users:"
                echo "$users" | while read -r u; do echo "    - $u"; done
            fi
            if [ -n "$groups" ]; then
                echo "  Allowed groups:"
                echo "$groups" | while read -r g; do echo "    - $g"; done
            fi
        fi
    done
}
```

---

## 2. Patch `tinyclaw.sh`

### 2a. Add source line (after existing sources, ~line 33)

```diff
 source "$SCRIPT_DIR/lib/teams.sh"
 source "$SCRIPT_DIR/lib/update.sh"
+source "$SCRIPT_DIR/lib/access.sh"
```

### 2b. Add 6 new CLI commands (before the `*)` catch-all case)

Insert these case blocks just before the final `*)` block:

```bash
    allow)
        if [ -z "$2" ] || [ -z "$3" ]; then
            echo "Usage: $0 allow <channel> <user_id>"
            exit 1
        fi
        access_allow_user "$2" "$3"
        ;;
    deny)
        if [ -z "$2" ] || [ -z "$3" ]; then
            echo "Usage: $0 deny <channel> <user_id>"
            exit 1
        fi
        access_deny_user "$2" "$3"
        ;;
    allow-group)
        if [ -z "$2" ] || [ -z "$3" ]; then
            echo "Usage: $0 allow-group <channel> <group_id>"
            exit 1
        fi
        access_allow_group "$2" "$3"
        ;;
    deny-group)
        if [ -z "$2" ] || [ -z "$3" ]; then
            echo "Usage: $0 deny-group <channel> <group_id>"
            exit 1
        fi
        access_deny_group "$2" "$3"
        ;;
    allowed)
        access_list
        ;;
    default-team)
        if [ -z "$2" ]; then
            # Show current default team bindings
            _ensure_settings
            echo -e "${BLUE}Default Team Bindings${NC}"
            echo ""
            for ch in "${VALID_CHANNELS[@]}"; do
                dt=$(jq -r ".channels.$ch.default_team // empty" "$SETTINGS_FILE" 2>/dev/null)
                if [ -n "$dt" ]; then
                    echo -e "  ${YELLOW}$ch${NC} → $dt"
                fi
            done
            if ! jq -e '.channels | to_entries[] | select(.value.default_team) | .key' "$SETTINGS_FILE" &>/dev/null; then
                echo "  (no default teams configured)"
            fi
        elif [ -z "$3" ]; then
            echo "Usage: $0 default-team <channel> <team_id>"
            echo "       $0 default-team <channel> --clear"
            echo "       $0 default-team"
            exit 1
        elif [ "$3" = "--clear" ]; then
            access_clear_default_team "$2"
        else
            access_set_default_team "$2" "$3"
        fi
        ;;
```

### 2c. Update help/usage text in the `*)` block

Add these lines to the `echo` help section (after the `team` line, before `update`):

```bash
        echo "  allow <channel> <id>     Allow a user on a channel"
        echo "  deny <channel> <id>      Remove a user from allowlist"
        echo "  allow-group <channel> <id>  Allow a group/guild on a channel"
        echo "  deny-group <channel> <id>   Remove a group from allowlist"
        echo "  allowed                  List all access control settings"
        echo "  default-team [ch] [team] Set/show/clear default team per channel"
```

Also update the Usage line to include the new commands:

```diff
-        echo "Usage: $0 {start|stop|restart|status|setup|send|logs|reset|channels|provider|model|agent|team|update|attach}"
+        echo "Usage: $0 {start|stop|restart|status|setup|send|logs|reset|channels|provider|model|agent|team|allow|deny|allow-group|deny-group|allowed|default-team|update|attach}"
```

---

## 3. Patch `lib/teams.sh` — Append `team_reset()`

Add this function at the end of the file:

```bash
team_reset() {
    local team_id="$1"

    if [ ! -f "$SETTINGS_FILE" ]; then
        echo -e "${RED}No settings file found.${NC}"
        exit 1
    fi

    local agent_json
    agent_json=$(jq -r ".teams.\"${team_id}\" // empty" "$SETTINGS_FILE" 2>/dev/null)

    if [ -z "$agent_json" ]; then
        echo -e "${RED}Team '${team_id}' not found.${NC}"
        exit 1
    fi

    local teams_dir="$HOME/.tinyclaw/teams"
    mkdir -p "$teams_dir/$team_id"
    touch "$teams_dir/$team_id/reset_flag"

    local agent_name
    agent_name=$(jq -r ".teams.\"${team_id}\".name" "$SETTINGS_FILE" 2>/dev/null)

    echo -e "${GREEN}Reset flag set for team '${team_id}' (${agent_name})${NC}"
    echo ""
    echo "The next message to @${team_id} will start a fresh conversation."
}
```

---

## 4. Patch `src/channels/telegram-client.ts`

### 4a. Add access control functions (after the constants/imports, before `// Ensure directories exist`)

```typescript
// Access control: load allowed users/groups from settings
function loadAccessControl(): { allowed_users: string[]; allowed_groups: string[] } {
    try {
        const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
        const settings = JSON.parse(data);
        const ch = settings.channels?.telegram || {};
        return {
            allowed_users: Array.isArray(ch.allowed_users) ? ch.allowed_users.map(String) : [],
            allowed_groups: Array.isArray(ch.allowed_groups) ? ch.allowed_groups.map(String) : [],
        };
    } catch {
        return { allowed_users: [], allowed_groups: [] };
    }
}

function isAllowed(userId: string, groupId?: string): boolean {
    const { allowed_users, allowed_groups } = loadAccessControl();
    // No allowlist configured — allow everyone (backwards compatible)
    if (allowed_users.length === 0 && allowed_groups.length === 0) return true;
    if (userId && allowed_users.includes(userId)) return true;
    if (groupId && allowed_groups.includes(groupId)) return true;
    return false;
}
```

### 4b. Replace the DM-only check in the message handler (~line 260-264)

**Replace:**
```typescript
        // Skip group/channel messages - only handle private chats
        if (msg.chat.type !== 'private') {
            return;
        }
```

**With:**
```typescript
        // Access control: check if user/group is allowed
        const telegramUserId = msg.from ? msg.from.id.toString() : '';
        const telegramGroupId = msg.chat.type !== 'private' ? msg.chat.id.toString() : undefined;

        if (!isAllowed(telegramUserId, telegramGroupId)) {
            log('INFO', `Blocked message from unauthorized user/group: ${telegramUserId} / ${telegramGroupId}`);
            return;
        }
```

---

## 5. Patch `src/channels/whatsapp-client.ts`

### 5a. Add access control functions (after constants, before `// Ensure directories exist`)

```typescript
// Access control: load allowed users/groups from settings
function loadAccessControl(): { allowed_users: string[]; allowed_groups: string[] } {
    try {
        const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
        const settings = JSON.parse(data);
        const ch = settings.channels?.whatsapp || {};
        return {
            allowed_users: Array.isArray(ch.allowed_users) ? ch.allowed_users.map(String) : [],
            allowed_groups: Array.isArray(ch.allowed_groups) ? ch.allowed_groups.map(String) : [],
        };
    } catch {
        return { allowed_users: [], allowed_groups: [] };
    }
}

function isAllowed(userId: string, groupId?: string): boolean {
    const { allowed_users, allowed_groups } = loadAccessControl();
    if (allowed_users.length === 0 && allowed_groups.length === 0) return true;
    if (userId && allowed_users.includes(userId)) return true;
    if (groupId && allowed_groups.includes(groupId)) return true;
    return false;
}
```

### 5b. Replace the group skip in the message handler (~line 243-247)

**Replace:**
```typescript
        // Skip group messages
        if (chat.isGroup) {
            return;
        }
```

**With:**
```typescript
        // Access control: check if user/group is allowed
        if (chat.isGroup) {
            const groupId = chat.id._serialized;
            const authorId = message.author;
            if (!isAllowed(authorId || '', groupId)) {
                log('INFO', `Blocked message from unauthorized user/group: ${authorId} / ${groupId}`);
                return;
            }
        } else {
            if (!isAllowed(message.from)) {
                log('INFO', `Blocked message from unauthorized user: ${message.from}`);
                return;
            }
        }
```

---

## 6. Patch `src/channels/discord-client.ts`

### 6a. Add access control functions (after constants, before `// Ensure directories exist`)

```typescript
// Access control: load allowed users/groups from settings
function loadAccessControl(): { allowed_users: string[]; allowed_groups: string[] } {
    try {
        const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
        const settings = JSON.parse(data);
        const ch = settings.channels?.discord || {};
        return {
            allowed_users: Array.isArray(ch.allowed_users) ? ch.allowed_users.map(String) : [],
            allowed_groups: Array.isArray(ch.allowed_groups) ? ch.allowed_groups.map(String) : [],
        };
    } catch {
        return { allowed_users: [], allowed_groups: [] };
    }
}

function isAllowed(userId: string, guildId?: string): boolean {
    const { allowed_users, allowed_groups } = loadAccessControl();
    if (allowed_users.length === 0 && allowed_groups.length === 0) return true;
    if (userId && allowed_users.includes(userId)) return true;
    if (guildId && allowed_groups.includes(guildId)) return true;
    return false;
}
```

### 6b. Replace the guild skip in the message handler (~line 230-234)

**Replace:**
```typescript
        // Skip non-DM messages (guild = server channel)
        if (message.guild) {
            return;
        }
```

**With:**
```typescript
        // Access control: check if user/guild is allowed
        const discordUserId = message.author.id;
        const discordGuildId = message.guild ? message.guild.id : undefined;

        if (!isAllowed(discordUserId, discordGuildId)) {
            log('INFO', `Blocked message from unauthorized user/guild: ${discordUserId} / ${discordGuildId}`);
            return;
        }
```

---

## 7. Patch `src/queue-processor.ts` — Default Team Routing

Add this block **after** the existing `parseAgentRouting()` call (~line 68, after `message = routing.message;`)
and **before** the `agentId === 'error'` easter-egg check (~line 73):

```typescript
        // If no explicit @team prefix, check channel default_team
        if (agentId === 'default') {
            const settings = getSettings();
            const channelDefaultTeam = settings?.channels?.[channel as keyof typeof settings.channels];
            const defaultTeamId = (channelDefaultTeam as any)?.default_team;
            if (defaultTeamId && agents[defaultTeamId]) {
                agentId = defaultTeamId;
            }
        }
```

> Note: `getSettings()` is already imported via `./lib/config`. The `channel` variable
> is available from `messageData.channel`. If `settings` is already loaded earlier in
> the function, reuse it instead of calling `getSettings()` again.

---

## settings.json Schema (for reference)

After applying this patch, `~/.tinyclaw/settings.json` supports this structure per channel:

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "allowed_users": ["123456789", "987654321"],
      "allowed_groups": ["-1001234567890"],
      "default_team": "coder"
    },
    "whatsapp": {
      "enabled": true,
      "allowed_users": ["5511999999999@c.us"],
      "allowed_groups": [],
      "default_team": "assistant"
    },
    "discord": {
      "enabled": false,
      "allowed_users": ["112233445566778899"],
      "allowed_groups": ["998877665544332211"],
      "default_team": "dev"
    }
  }
}
```

---

## Quick-Reference: CLI Commands After Patch

```bash
# User access control
./tinyclaw.sh allow telegram 123456789        # Whitelist a Telegram user
./tinyclaw.sh deny telegram 123456789         # Remove from whitelist
./tinyclaw.sh allow-group telegram -100123    # Whitelist a Telegram group
./tinyclaw.sh deny-group telegram -100123     # Remove group from whitelist
./tinyclaw.sh allowed                          # List all access settings

# Default team per channel
./tinyclaw.sh default-team                     # Show all bindings
./tinyclaw.sh default-team telegram coder      # Route telegram → @coder
./tinyclaw.sh default-team telegram --clear    # Remove default

# Team reset (conversation reset for a specific team)
./tinyclaw.sh team reset <team_id>
```

---

## Post-Process: Configure Your Current Settings

Your existing configuration lives in two places:

| File | Contains |
|------|----------|
| `~/.tinyclaw/settings.json` | All settings (channels, models, teams, access control) |
| `/home/ubuntu/tinyclaw/.env` | `TELEGRAM_BOT_TOKEN` for the channel client process |
| `/home/ubuntu/tinyclaw/.tinyclaw/settings.json` | Older local copy (no access control yet) |

### Current values already in `~/.tinyclaw/settings.json`:

| Setting | Value |
|---------|-------|
| Telegram bot token | `HIDDEN` |
| Telegram whitelisted user | `1471948635` |
| Telegram default team | `coder` |
| WhatsApp whitelisted users | `+33695058137`, `33695058137@c.us` |
| WhatsApp default team | `assistant` |

### Run these commands after applying the patch to verify/set everything:

```bash
# --- 1. Verify .env has the bot token ---
grep TELEGRAM_BOT_TOKEN /home/ubuntu/tinyclaw/.env

# --- 2. Set up Telegram access control ---
./tinyclaw.sh allow telegram 1471948635

# --- 3. Set up WhatsApp access control ---
./tinyclaw.sh allow whatsapp "+33695058137"
./tinyclaw.sh allow whatsapp "33695058137@c.us"

# --- 4. Set default teams per channel ---
./tinyclaw.sh default-team telegram coder
./tinyclaw.sh default-team whatsapp assistant

# --- 5. Verify everything is configured ---
./tinyclaw.sh allowed
./tinyclaw.sh default-team

# --- 6. Restart to pick up changes ---
./tinyclaw.sh restart
```

> **Note:** The `allow` / `default-team` commands are idempotent — running them
> when the values already exist in settings.json is safe (uses `unique` dedup).
> Your `~/.tinyclaw/settings.json` already has these values, so the commands above
> will simply confirm them. The `.env` file is only read by the Telegram channel
> client at startup; the bot token in settings.json is used by the setup wizard.

---