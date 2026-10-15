#!/usr/bin/env python3
"""Private, tenant-agnostic control bridge for the Kytto-local WAHA API.

The bridge is reachable only from the private Kytto application network. It never
returns the WAHA admin key and only exposes the minimal operations required by
Kytto: provision a session, read status, read a QR image, and list
chat groups without participants or message content.
"""
from __future__ import annotations

import base64
import binascii
import hmac
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

WAHA_URL = os.environ.get("WAHA_URL", "http://127.0.0.1:3000").rstrip("/")
BRIDGE_SECRET = os.environ.get("WAHA_CONTROL_BRIDGE_SECRET", "")
WEBHOOK_URL = os.environ.get("WAHA_WEBHOOK_URL", "https://dino.kytto.com.br/api/webhooks/waha")
WEBHOOK_SECRET = os.environ.get("WAHA_WEBHOOK_SECRET", "")
WEBHOOK_HMAC_KEY = os.environ.get("WAHA_WEBHOOK_HMAC_KEY", "")
API_KEY_FILE = Path(os.environ.get("WAHA_API_KEY_FILE", "/opt/kytto-waha/api-key.plaintext"))
SESSION_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{1,119}$")
MAX_BODY_BYTES = 2 * 1024 * 1024
MAX_MEDIA_BYTES = 15 * 1024 * 1024


def api_key() -> str:
    return API_KEY_FILE.read_text(encoding="utf-8").strip()


def session_name(value: Any) -> str:
    name = str(value or "").strip()
    if not SESSION_PATTERN.fullmatch(name):
        raise BridgeError(400, "Nome de sessão WAHA inválido.")
    return name


class BridgeError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def waha_request(
    method: str,
    path: str,
    body: dict[str, Any] | None = None,
    accept: str = "application/json",
) -> tuple[int, str, bytes]:
    payload = None
    headers = {"X-Api-Key": api_key(), "Accept": accept}
    if body is not None:
        payload = json.dumps(body, separators=(",", ":")).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(f"{WAHA_URL}{path}", data=payload, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            return response.status, response.headers.get("Content-Type", ""), response.read()
    except urllib.error.HTTPError as error:
        response_body = error.read(4096)
        if error.code == 404:
            raise BridgeError(404, "Sessão WAHA não encontrada.") from error
        if error.code in (401, 403):
            raise BridgeError(502, "A ponte não conseguiu autenticar na instância WAHA.") from error
        if error.code == 422:
            raise BridgeError(409, "A sessão WAHA ainda não está pronta para esta operação.") from error
        if error.code == 500 and path.endswith("/auth/request-code"):
            raise BridgeError(409, "O pairing code não está disponível nesta sessão WEBJS agora; use o QR Code novo como alternativa.") from error
        raise BridgeError(502, f"A instância WAHA recusou a operação (HTTP {error.code}).") from error
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        raise BridgeError(503, "A instância WAHA está indisponível.") from error


def json_request(method: str, path: str, body: dict[str, Any] | None = None) -> Any:
    _status, _content_type, raw = waha_request(method, path, body)
    try:
        return json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise BridgeError(502, "A instância WAHA retornou uma resposta inválida.") from error


def summarize_session(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        return {"status": "UNKNOWN", "engine": None}
    engine = raw.get("engine")
    if isinstance(engine, dict):
        engine = engine.get("engine")
    return {
        "name": str(raw.get("name") or ""),
        "status": str(raw.get("status") or "UNKNOWN").upper(),
        "engine": str(engine or "") or None,
    }


def session_status(name: str) -> dict[str, Any]:
    return summarize_session(json_request("GET", f"/api/sessions/{urllib.parse.quote(name, safe='')}"))


def logout_session(name: str) -> None:
    json_request("POST", "/api/sessions/logout", {"name": name})


def request_pairing_code(name: str, phone_number: str) -> str:
    if not re.fullmatch(r"\d{8,15}", phone_number):
        raise BridgeError(400, "Informe o telefone com DDI, somente números, sem + ou espaços.")
    payload = json_request(
        "POST",
        f"/api/{urllib.parse.quote(name, safe='')}/auth/request-code",
        {"phoneNumber": phone_number},
    )
    code = payload.get("code") if isinstance(payload, dict) else None
    if not isinstance(code, str) or not code.strip():
        raise BridgeError(502, "A instância WAHA não retornou um código de pareamento.")
    return code.strip()[:64]


def configure_session(name: str) -> dict[str, Any]:
    if not WEBHOOK_SECRET or not WEBHOOK_HMAC_KEY or not BRIDGE_SECRET:
        raise BridgeError(503, "A configuração segura do bridge está incompleta.")
    payload = {
        "name": name,
        "config": {
            "webhooks": [{
                "url": WEBHOOK_URL,
                "events": ["message", "session.status"],
                "hmac": {"key": WEBHOOK_HMAC_KEY},
                "retries": {"policy": "exponential", "delaySeconds": 2, "attempts": 6},
                "customHeaders": [{"name": "X-Waha-Webhook-Secret", "value": WEBHOOK_SECRET}],
            }],
        },
    }
    try:
        json_request("GET", f"/api/sessions/{urllib.parse.quote(name, safe='')}")
    except BridgeError as error:
        if error.status != 404:
            raise
        json_request("POST", "/api/sessions", payload)
    else:
        json_request("POST", f"/api/sessions/{urllib.parse.quote(name, safe='')}/", payload)
    try:
        waha_request("POST", f"/api/sessions/{urllib.parse.quote(name, safe='')}/start", {})
    except BridgeError as error:
        if error.status not in (409, 422):
            raise
    return session_status(name)


def list_groups(name: str) -> list[dict[str, str]]:
    query = urllib.parse.urlencode({"limit": "100", "offset": "0", "sortBy": "subject", "sortOrder": "asc", "exclude": "participants"})
    raw = json_request("GET", f"/api/{urllib.parse.quote(name, safe='')}/groups?{query}")
    source = raw if isinstance(raw, list) else raw.get("data", []) if isinstance(raw, dict) else []
    result: list[dict[str, str]] = []
    for item in source:
        if not isinstance(item, dict):
            continue
        group_id = item.get("id")
        if isinstance(group_id, dict):
            group_id = group_id.get("_serialized") or group_id.get("serialized") or group_id.get("id")
        subject = item.get("subject") or item.get("name") or item.get("title")
        if isinstance(group_id, str) and isinstance(subject, str) and group_id.endswith("@g.us"):
            result.append({"id": group_id[:180], "subject": subject[:255]})
    return result[:100]


def qr_image(content_type: str, raw: bytes) -> tuple[str, bytes]:
    media_type = content_type.split(";", 1)[0].strip().lower()
    if media_type.startswith("image/"):
        return media_type, raw
    try:
        payload = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise BridgeError(502, "A instância WAHA retornou um QR Code inválido.") from error
    if not isinstance(payload, dict) or not isinstance(payload.get("data"), str):
        raise BridgeError(502, "A instância WAHA não retornou uma imagem de QR Code.")
    encoded = payload["data"].strip()
    if "," in encoded and encoded.lower().startswith("data:"):
        encoded = encoded.split(",", 1)[1]
    try:
        image = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as error:
        raise BridgeError(502, "A instância WAHA retornou um QR Code inválido.") from error
    if not image:
        raise BridgeError(502, "A instância WAHA retornou um QR Code vazio.")
    returned_type = str(payload.get("mimetype") or "image/png").split(";", 1)[0].lower()
    return returned_type if returned_type.startswith("image/") else "image/png", image


def download_media(name: str, media_url: str) -> tuple[str, bytes]:
    """Download a WAHA-owned media file without permitting an SSRF target.

    WAHA may serialize the same local file with the container hostname,
    localhost, or the bridge's loopback address. Only the parsed path is ever
    used for the request, and it must be the WAHA file endpoint, so an
    absolute URL can never redirect this bridge to an external host.
    """
    value = str(media_url or "").strip()
    if not value:
        raise BridgeError(409, "A mídia recebida não possui URL disponível.")
    parsed = urllib.parse.urlsplit(value)
    path = parsed.path or value.split("?", 1)[0]
    if not path.startswith("/api/files/") or ".." in path:
        raise BridgeError(400, "A referência de mídia WAHA é inválida.")
    query = f"?{parsed.query}" if parsed.query else ""
    _status, content_type, raw = waha_request("GET", f"{path}{query}", accept="*/*")
    if len(raw) == 0:
        raise BridgeError(502, "A instância WAHA retornou uma mídia vazia.")
    if len(raw) > MAX_MEDIA_BYTES:
        raise BridgeError(413, "A mídia recebida excede o limite de 15 MB.")
    normalized_type = content_type.split(";", 1)[0].strip().lower() or "application/octet-stream"
    allowed_prefixes = ("image/", "application/pdf", "text/plain", "text/csv", "application/vnd.")
    if not normalized_type.startswith(allowed_prefixes):
        raise BridgeError(415, "O tipo de mídia recebido não é suportado para extração.")
    return normalized_type, raw


def chat_id(value: Any) -> str:
    value = str(value or "").strip()
    if not value.endswith("@g.us") or len(value) > 180:
        raise BridgeError(400, "O destino do assistente precisa ser um grupo autorizado.")
    return value


def send_text(name: str, target: str, message: str) -> None:
    message = str(message or "").strip()
    if not message or len(message) > 4000:
        raise BridgeError(400, "A resposta de texto está vazia ou excede o limite.")
    waha_request("POST", "/api/sendText", {"session": name, "chatId": chat_id(target), "text": message})


def send_image(name: str, target: str, content_type: str, filename: str, encoded: str, caption: str) -> None:
    media_type = str(content_type or "image/png").split(";", 1)[0].strip().lower()
    if media_type not in ("image/png", "image/jpeg", "image/webp"):
        raise BridgeError(415, "O gráfico precisa ser PNG, JPEG ou WEBP.")
    encoded = str(encoded or "").strip()
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as error:
        raise BridgeError(400, "O gráfico recebido é inválido.") from error
    if not raw or len(raw) > 1_000_000:
        raise BridgeError(413, "O gráfico excede o limite permitido.")
    safe_filename = re.sub(r"[^A-Za-z0-9_.-]", "_", str(filename or "grafico.png"))[:120] or "grafico.png"
    payload = {
        "session": name,
        "chatId": chat_id(target),
        "file": {"mimetype": media_type, "filename": safe_filename, "data": f"data:{media_type};base64,{encoded}"},
        "caption": str(caption or "").strip()[:500],
    }
    waha_request("POST", "/api/sendImage", payload)


class Handler(BaseHTTPRequestHandler):
    server_version = "KyttoWahaBridge/1.0"

    def log_message(self, format: str, *args: Any) -> None:
        # Do not log headers, bodies, QR data, group participants or messages.
        print(f"[waha-bridge] {self.command} {self.path.split('?')[0]} status={args[-1] if args else ''}", flush=True)

    def authorized(self) -> bool:
        provided = self.headers.get("X-Kytto-Waha-Bridge-Secret", "")
        return bool(BRIDGE_SECRET and provided and hmac.compare_digest(provided, BRIDGE_SECRET))

    def send_json(self, status: int, payload: dict[str, Any]) -> None:
        data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:
        if self.path == "/health":
            self.send_json(200, {"ok": True})
            return
        if not self.authorized():
            self.send_json(401, {"message": "Não autorizado."})
            return
        parts = urllib.parse.urlsplit(self.path).path.rstrip("/").split("/")
        try:
            if len(parts) == 5 and parts[1:3] == ["v1", "sessions"] and parts[4] == "status":
                name = session_name(urllib.parse.unquote(parts[3]))
                self.send_json(200, session_status(name))
                return
            if len(parts) == 5 and parts[1:3] == ["v1", "sessions"] and parts[4] == "groups":
                name = session_name(urllib.parse.unquote(parts[3]))
                self.send_json(200, {"groups": list_groups(name)})
                return
            if len(parts) == 5 and parts[1:3] == ["v1", "sessions"] and parts[4] == "qr":
                name = session_name(urllib.parse.unquote(parts[3]))
                _status, content_type, raw_qr = waha_request(
                    "GET",
                    f"/api/{urllib.parse.quote(name, safe='')}/auth/qr",
                    accept="image/png",
                )
                content_type, image = qr_image(content_type, raw_qr)
                self.send_response(200)
                self.send_header("Content-Type", content_type.split(";", 1)[0] or "image/png")
                self.send_header("Cache-Control", "no-store, no-cache, max-age=0")
                self.send_header("Content-Length", str(len(image)))
                self.end_headers()
                self.wfile.write(image)
                return
            self.send_json(404, {"message": "Operação não encontrada."})
        except BridgeError as error:
            self.send_json(error.status, {"message": error.message})
        except Exception:
            self.send_json(500, {"message": "Falha interna no bridge WAHA."})

    def do_POST(self) -> None:
        if not self.authorized():
            self.send_json(401, {"message": "Não autorizado."})
            return
        path = urllib.parse.urlsplit(self.path).path.rstrip("/")
        if path not in ("/v1/sessions/provision", "/v1/sessions/logout") and not re.fullmatch(r"/v1/sessions/[A-Za-z0-9][A-Za-z0-9_-]{1,119}/(pairing-code|media|send-text|send-image)", path):
            self.send_json(404, {"message": "Operação não encontrada."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY_BYTES:
                raise BridgeError(400, "Payload inválido.")
            raw = self.rfile.read(length)
            body = json.loads(raw.decode("utf-8"))
            if path == "/v1/sessions/provision":
                name = session_name(body.get("session")) if isinstance(body, dict) else ""
                self.send_json(200, configure_session(name))
                return
            if path == "/v1/sessions/logout":
                name = session_name(body.get("session") or body.get("name")) if isinstance(body, dict) else ""
                logout_session(name)
                self.send_json(202, {"loggedOut": True})
                return
            match = re.fullmatch(r"/v1/sessions/([A-Za-z0-9][A-Za-z0-9_-]{1,119})/pairing-code", path)
            if match:
                name = session_name(match.group(1))
                phone_number = body.get("phoneNumber", "") if isinstance(body, dict) else ""
                self.send_json(200, {"code": request_pairing_code(name, str(phone_number).strip())})
                return
            media_match = re.fullmatch(r"/v1/sessions/([A-Za-z0-9][A-Za-z0-9_-]{1,119})/media", path)
            if media_match:
                name = session_name(media_match.group(1))
                media_type, raw_media = download_media(name, body.get("url", "") if isinstance(body, dict) else "")
                self.send_response(200)
                self.send_header("Content-Type", media_type)
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(raw_media)))
                self.end_headers()
                self.wfile.write(raw_media)
                return
            send_text_match = re.fullmatch(r"/v1/sessions/([A-Za-z0-9][A-Za-z0-9_-]{1,119})/send-text", path)
            if send_text_match:
                name = session_name(send_text_match.group(1))
                send_text(name, body.get("chatId", "") if isinstance(body, dict) else "", body.get("text", "") if isinstance(body, dict) else "")
                self.send_json(202, {"sent": True})
                return
            send_image_match = re.fullmatch(r"/v1/sessions/([A-Za-z0-9][A-Za-z0-9_-]{1,119})/send-image", path)
            if send_image_match:
                name = session_name(send_image_match.group(1))
                if not isinstance(body, dict):
                    raise BridgeError(400, "Payload inválido.")
                send_image(name, body.get("chatId", ""), body.get("contentType", "image/png"), body.get("filename", "grafico.png"), body.get("base64", ""), body.get("caption", ""))
                self.send_json(202, {"sent": True})
                return
            self.send_json(404, {"message": "Operação não encontrada."})
        except BridgeError as error:
            self.send_json(error.status, {"message": error.message})
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError):
            self.send_json(400, {"message": "Payload inválido."})
        except Exception:
            self.send_json(500, {"message": "Falha interna no bridge WAHA."})


if __name__ == "__main__":
    if not BRIDGE_SECRET:
        raise SystemExit("WAHA_CONTROL_BRIDGE_SECRET ausente")
    bind = os.environ.get("WAHA_CONTROL_BRIDGE_BIND", "0.0.0.0")
    port = int(os.environ.get("WAHA_CONTROL_BRIDGE_PORT", "3040"))
    print(f"[waha-bridge] listening={bind}:{port}", flush=True)
    ThreadingHTTPServer((bind, port), Handler).serve_forever()
