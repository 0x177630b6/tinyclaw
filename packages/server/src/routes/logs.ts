import fs from 'fs';
import path from 'path';
import { Hono } from 'hono';
import { LOG_FILE, TINYAGI_HOME } from '@tinyagi/core';

const app = new Hono();

// GET /api/logs
app.get('/api/logs', (c) => {
    const limit = parseInt(c.req.query('limit') || '100', 10);
    try {
        const logContent = fs.readFileSync(LOG_FILE, 'utf8');
        const lines = logContent.trim().split('\n').slice(-limit);
        return c.json({ lines });
    } catch {
        return c.json({ lines: [] });
    }
});

// GET /api/agents/:id/logs — returns JSONL log entries for an agent
app.get('/api/agents/:id/logs', (c) => {
    const agentId = c.req.param('id');
    const limit = parseInt(c.req.query('limit') || '100', 10);
    const logPath = path.join(TINYAGI_HOME, 'logs', `agent-${agentId}.jsonl`);

    try {
        if (!fs.existsSync(logPath)) {
            return c.json({ entries: [] });
        }
        const content = fs.readFileSync(logPath, 'utf8');
        const lines = content.trim().split('\n').filter(l => l.trim());
        const entries: unknown[] = [];
        // Parse from the end (most recent first), take last `limit`
        const startIdx = Math.max(0, lines.length - limit);
        for (let i = startIdx; i < lines.length; i++) {
            try {
                entries.push(JSON.parse(lines[i]!));
            } catch {
                // skip malformed lines
            }
        }
        return c.json({ entries, total: lines.length });
    } catch {
        return c.json({ entries: [], total: 0 });
    }
});

export default app;
