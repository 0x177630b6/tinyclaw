import fs from 'fs';
import path from 'path';
import { AgentAdapter, InvokeOptions } from './types';
import { runCommand, runCommandStreaming } from '../invoke';
import { log, emitEvent } from '../logging';
import { TINYAGI_HOME } from '../config';

/**
 * Extract displayable text from a Claude stream-json event.
 * Skips 'result' events — those duplicate the final assistant message.
 */
function extractEventText(json: any): string | null {
    if (json.type === 'assistant' && json.message?.content) {
        const parts: string[] = [];
        for (const block of json.message.content) {
            if (block.type === 'text' && block.text) {
                parts.push(block.text);
            } else if (block.type === 'tool_use' && block.name) {
                parts.push(`[tool: ${block.name}]`);
            }
        }
        return parts.length > 0 ? parts.join('\n') : null;
    }
    return null;
}

export const claudeAdapter: AgentAdapter = {
    providers: ['anthropic'],

    async invoke(opts: InvokeOptions): Promise<string> {
        const { agentId, message, workingDir, systemPrompt, model, shouldReset, envOverrides, onEvent } = opts;
        log('DEBUG', `Using Claude provider (agent: ${agentId})`);

        const continueConversation = !shouldReset;
        if (shouldReset) {
            log('INFO', `Resetting conversation for agent: ${agentId}`);
        }

        const args = ['--dangerously-skip-permissions'];
        if (model) args.push('--model', model);
        // System prompt disabled — agents use CLAUDE.md in their workspace instead
        // if (systemPrompt) args.push('--system-prompt', systemPrompt);
        if (continueConversation) args.push('-c');

        if (onEvent) {
            args.push('--output-format', 'stream-json', '--verbose', '-p', message);

            let response = '';
            const logDir = path.join(TINYAGI_HOME, 'logs');
            fs.mkdirSync(logDir, { recursive: true });
            const logPath = path.join(logDir, `agent-${agentId}.jsonl`);

            await runCommandStreaming('claude', args, (line) => {
                // Tee to per-agent JSONL log
                try { fs.appendFileSync(logPath, line + '\n'); } catch { /* ignore write errors */ }

                try {
                    const json = JSON.parse(line);
                    if (json.type === 'result') {
                        if (json.result) response = json.result;
                        if (json.usage) {
                            log('INFO', `Claude usage (${agentId}): ${JSON.stringify(json.usage)}`);
                        }
                        if (json.modelUsage) {
                            log('INFO', `Claude model usage (${agentId}): ${JSON.stringify(json.modelUsage)}`);
                            emitEvent('usage_stats', { agentId, modelUsage: json.modelUsage });
                            // Persist usage to file for /context command
                            try {
                                const usageDir = path.join(TINYAGI_HOME, 'usage');
                                fs.mkdirSync(usageDir, { recursive: true });
                                fs.writeFileSync(path.join(usageDir, `${agentId}.json`), JSON.stringify({
                                    modelUsage: json.modelUsage,
                                    updatedAt: Date.now(),
                                }));
                            } catch { /* best-effort */ }
                        }
                        return;
                    }
                    const text = extractEventText(json);
                    if (text) {
                        response = text;
                        onEvent(text);
                    }
                } catch (e) {
                    // Ignore non-JSON lines
                }
            }, workingDir, envOverrides);

            return response || 'Sorry, I could not generate a response from Claude.';
        }

        args.push('-p', message);
        return await runCommand('claude', args, workingDir, envOverrides);
    },
};
