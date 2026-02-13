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
