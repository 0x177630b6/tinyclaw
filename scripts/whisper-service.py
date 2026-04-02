#!/usr/bin/env python3
"""
Whisper transcription microservice for TinyAGI.
Loads the faster-whisper model once and serves transcription requests via HTTP.

Usage:
    python3 scripts/whisper-service.py [--port 7378] [--model small]

Endpoints:
    POST /transcribe  — {"file": "/path/to/audio.ogg"} → {"text": "...", "language": "en", "duration": 4.2}
    GET  /health      — {"status": "ok", "model": "small"}
"""

import argparse
import json
import os
import sys
import time
from http.server import HTTPServer, BaseHTTPRequestHandler

# Parse args before loading model (so --help is fast)
parser = argparse.ArgumentParser(description="Whisper transcription service")
parser.add_argument("--port", type=int, default=int(os.environ.get("WHISPER_SERVICE_PORT", "7378")))
parser.add_argument("--model", type=str, default=os.environ.get("WHISPER_MODEL", "small"))
args = parser.parse_args()

# Load model at startup (takes ~5s, then stays in memory)
print(f"Loading faster-whisper model '{args.model}' (this may take a moment)...")
t0 = time.time()

from faster_whisper import WhisperModel

model = WhisperModel(args.model, device="cpu", compute_type="int8")
print(f"Model loaded in {time.time() - t0:.1f}s")


class TranscribeHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *a):
        # Suppress default access logs, we log ourselves
        pass

    def _send_json(self, code, data):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self._send_json(200, {"status": "ok", "model": args.model})
        else:
            self._send_json(404, {"error": "Not found"})

    def do_POST(self):
        if self.path != "/transcribe":
            self._send_json(404, {"error": "Not found"})
            return

        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length)) if length > 0 else {}
        except (json.JSONDecodeError, ValueError):
            self._send_json(400, {"error": "Invalid JSON"})
            return

        file_path = body.get("file")
        if not file_path or not os.path.isfile(file_path):
            self._send_json(400, {"error": f"File not found: {file_path}"})
            return

        try:
            t0 = time.time()
            segments, info = model.transcribe(file_path, beam_size=5)
            text = " ".join(seg.text.strip() for seg in segments)
            elapsed = time.time() - t0
            print(f"Transcribed {file_path} ({info.duration:.1f}s audio) in {elapsed:.1f}s — lang={info.language}")
            self._send_json(200, {
                "text": text,
                "language": info.language,
                "duration": round(info.duration, 2),
            })
        except Exception as e:
            print(f"Transcription error: {e}", file=sys.stderr)
            self._send_json(500, {"error": str(e)})


if __name__ == "__main__":
    server = HTTPServer(("127.0.0.1", args.port), TranscribeHandler)
    print(f"Whisper service listening on http://127.0.0.1:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down whisper service")
        server.server_close()
