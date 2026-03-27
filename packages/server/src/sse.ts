import http from 'http';
import { onEvent } from '@tinyagi/core';

const sseClients = new Set<http.ServerResponse>();

/** Broadcast an SSE event to every connected client. */
export function broadcastSSE(event: string, data: unknown): void {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
        try { client.write(message); } catch { sseClients.delete(client); }
    }
}

/** Convenience: broadcast a typed change event with a timestamp. */
export function broadcastChange(event: string): void {
    broadcastSSE(event, { type: event, timestamp: Date.now() });
}

export function addSSEClient(res: http.ServerResponse): void {
    sseClients.add(res);
}

export function removeSSEClient(res: http.ServerResponse): void {
    sseClients.delete(res);
}

// Wire emitEvent → SSE so every queue-processor event is also pushed to the web.
onEvent((type, data) => {
    broadcastSSE(type, { type, timestamp: Date.now(), ...data });
});
