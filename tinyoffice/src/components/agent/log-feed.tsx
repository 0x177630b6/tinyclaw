"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { usePolling } from "@/lib/hooks";
import { getAgentLogs } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChatContainerRoot,
  ChatContainerContent,
  ChatContainerScrollAnchor,
} from "@/components/ui/chat-container";
import { Pause, Play, Trash2, Terminal } from "lucide-react";

interface LogEntry {
  type?: string;
  message?: { content?: { type?: string; text?: string; name?: string; input?: Record<string, unknown> }[] };
  result?: string;
  [key: string]: unknown;
}

function renderToolUse(block: { name?: string; input?: Record<string, unknown> }) {
  const filePath =
    block.input?.file_path ||
    block.input?.path ||
    block.input?.command ||
    "";
  return (
    <div className="flex items-center gap-2 text-xs font-mono">
      <Badge variant="outline" className="text-[10px] text-cyan-500 border-cyan-500/30">
        {block.name}
      </Badge>
      {filePath && (
        <span className="text-cyan-400/70 truncate max-w-[400px]">
          {String(filePath)}
        </span>
      )}
    </div>
  );
}

function renderEntry(entry: LogEntry, idx: number) {
  // assistant event with tool_use content
  if (entry.type === "assistant" && entry.message?.content) {
    const tools = entry.message.content.filter((b) => b.type === "tool_use");
    const texts = entry.message.content.filter((b) => b.type === "text" && b.text);

    if (tools.length > 0) {
      return (
        <div key={idx} className="flex flex-col gap-1 py-1">
          {tools.map((t, i) => (
            <div key={i}>{renderToolUse(t)}</div>
          ))}
        </div>
      );
    }

    if (texts.length > 0) {
      return (
        <div key={idx} className="py-1">
          {texts.map((t, i) => (
            <p key={i} className="text-xs text-muted-foreground/60 truncate max-w-[600px]">
              {t.text}
            </p>
          ))}
        </div>
      );
    }
  }

  // result event
  if (entry.type === "result" && entry.result) {
    return (
      <div key={idx} className="py-1">
        <p className="text-xs font-semibold text-foreground truncate max-w-[600px]">
          {entry.result}
        </p>
      </div>
    );
  }

  // Unknown — show raw JSON dimmed
  return (
    <div key={idx} className="py-1">
      <p className="text-[10px] text-muted-foreground/40 font-mono truncate max-w-[600px]">
        {JSON.stringify(entry)}
      </p>
    </div>
  );
}

export function LogFeedTab({ agentId }: { agentId: string }) {
  const [paused, setPaused] = useState(false);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);

  const fetchLogs = useCallback(async () => {
    return getAgentLogs(agentId, 200);
  }, [agentId]);

  const { data } = usePolling<{ entries: LogEntry[]; total: number }>(
    fetchLogs,
    paused ? 0 : 3000,
    [agentId, paused]
  );

  useEffect(() => {
    if (data) {
      setEntries(data.entries);
      setTotal(data.total);
    }
  }, [data]);

  const handleClear = useCallback(() => {
    setEntries([]);
    setTotal(0);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Terminal className="h-3.5 w-3.5" />
          <span>Agent Activity Log</span>
          {total > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {total} entries
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setPaused(!paused)}
            title={paused ? "Resume polling" : "Pause polling"}
          >
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleClear}
            title="Clear log view"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Log entries */}
      {entries.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <Terminal className="h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            No activity logged yet
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Activity will appear here when the agent processes messages
          </p>
        </div>
      ) : (
        <ChatContainerRoot className="flex-1">
          <ChatContainerContent className="px-6 pt-2 pb-4">
            {entries.map((entry, idx) => renderEntry(entry, idx))}
            <ChatContainerScrollAnchor />
          </ChatContainerContent>
        </ChatContainerRoot>
      )}
    </div>
  );
}
