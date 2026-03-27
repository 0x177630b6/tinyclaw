"use client";

import { useSSEPolling } from "@/lib/hooks";
import {
  getAgentMessages,
  getAgents,
  getLogs,
  getQueueStatus,
  getResponses,
  getSettings,
  getTasks,
  getTeams,
  type AgentConfig,
  type AgentMessage,
  type QueueStatus,
  type ResponseData,
  type Settings,
  type Task,
  type TeamConfig,
} from "@/lib/api";

export function useOfficeData() {
  const { data: agents } = useSSEPolling<Record<string, AgentConfig>>(getAgents, 60000, ["agents:changed"]);
  const { data: teams } = useSSEPolling<Record<string, TeamConfig>>(getTeams, 60000, ["teams:changed"]);
  const { data: tasks } = useSSEPolling<Task[]>(getTasks, 30000, ["tasks:changed"]);
  const { data: queueStatus } = useSSEPolling<QueueStatus>(getQueueStatus, 30000, ["message:incoming", "agent:response", "message:done"]);
  const { data: responses } = useSSEPolling<ResponseData[]>(() => getResponses(6), 30000, ["agent:response", "message:done"]);
  const { data: settings } = useSSEPolling<Settings>(getSettings, 60000, ["settings:changed"]);
  const { data: logs } = useSSEPolling<{ lines: string[] }>(() => getLogs(40), 30000, ["message:incoming", "agent:response", "message:done"]);
  const { data: agentHistories } = useSSEPolling<Record<string, AgentMessage[]>>(
    async () => {
      if (!agents) return {};
      const results = await Promise.allSettled(
        Object.keys(agents).map(async (agentId) => [agentId, await getAgentMessages(agentId, 40)] as const),
      );
      const entries = results
        .filter((r): r is PromiseFulfilledResult<readonly [string, AgentMessage[]]> => r.status === "fulfilled")
        .map((r) => r.value);
      return Object.fromEntries(entries);
    },
    30000,
    ["agent:response", "message:done"],
    [agents],
  );

  return { agents, teams, tasks, queueStatus, responses, settings, logs, agentHistories };
}
