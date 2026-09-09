#!/usr/bin/env python3
"""AEROVOLT Modbus Gateway — IoT industrial edge. HTTP JSON <-> Modbus TCP. Ver ARCHITECTURE.md"""
from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

HOST = os.getenv("AEROVOLT_GW_HOST", "127.0.0.1")
PORT = int(os.getenv("AEROVOLT_GW_PORT", "8750"))
TOKEN = os.getenv("AEROVOLT_GW_TOKEN", "")
FIELD = os.getenv("AEROVOLT_MODBUS_FIELD", "0") == "1"
SOURCE = "FIELD" if FIELD else "DEMO"

SIM: dict = {}
LOCK = threading.Lock()
LOG: list = []

ARCH = {
    "service": "aerovolt-modbus-gateway",
    "role": "industrial_iot_edge",
    "cyberdeck": False,
    "layers": ["web_om", "gateway_http", "modbus_tcp_field"],
    "endpoints": [
        "GET /health",
        "GET /architecture",
        "GET /log",
        "POST /modbus/read",
        "POST /modbus/telemetry",
        "POST /modbus/emergency",
        "POST /api/shutdown",
    ],
}


def now():
    return datetime.now(timezone.utc).isoformat()


def log(msg: str, **extra):
    row = {"at": now(), "msg": msg, **extra}
    LOG.insert(0, row)
    del LOG[200:]
    print(json.dumps(row, ensure_ascii=False))


def ensure_device(device_id: str):
    if device_id not in SIM:
        SIM[device_id] = {
            "coils": {0: False},
            "holding": {
                100: 780, 101: 6120, 102: 1280, 103: 4800,
                104: 940, 105: 6000, 110: 0, 111: 0,
            },
        }


def decode_reg(reg: dict, raw: int) -> float:
    return raw * float(reg.get("scale", 1)) + float(reg.get("offset", 0))


def try_write_coil(host: str, unit_id: int, address: int, value: bool):
    if not FIELD:
        return False, "FIELD off"
    try:
        from pymodbus.client import ModbusTcpClient
    except Exception as e:
        return False, f"pymodbus: {e}"
    client = ModbusTcpClient(host=host, port=502, timeout=2)
    try:
        if not client.connect():
            return False, f"no conecta {host}:502"
        rr = client.write_coil(address, value, device_id=unit_id)
        if rr.isError():
            return False, str(rr)
        return True, "coil OK"
    except Exception as e:
        return False, str(e)
    finally:
        client.close()


def try_read_holding(host: str, unit_id: int, address: int):
    if not FIELD:
        return None, "FIELD off"
    try:
        from pymodbus.client import ModbusTcpClient
    except Exception as e:
        return None, str(e)
    client = ModbusTcpClient(host=host, port=502, timeout=2)
    try:
        if not client.connect():
            return None, "connect fail"
        rr = client.read_holding_registers(address, count=1, device_id=unit_id)
        if rr.isError():
            return None, str(rr)
        return list(rr.registers), "ok"
    except Exception as e:
        return None, str(e)
    finally:
        client.close()


def read_device_payload(device: dict) -> dict:
    device_id = device.get("id") or "UNKNOWN"
    host = device.get("host") or "127.0.0.1"
    unit_id = int(device.get("unitId") or 1)
    registers = device.get("registers") or []
    values, raw_map = {}, {}
    with LOCK:
        ensure_device(device_id)
        for reg in registers:
            addr = int(reg.get("address") or 0)
            key = reg.get("key") or f"reg_{addr}"
            if FIELD:
                regs, err = try_read_holding(host, unit_id, addr)
                if regs is not None:
                    raw_map[key] = regs[0]
                    values[key] = decode_reg(reg, regs[0])
                    continue
                log("read_fallback_sim", device=device_id, err=err)
            raw_val = int(SIM[device_id]["holding"].get(addr, 0))
            raw_map[key] = raw_val
            values[key] = decode_reg(reg, raw_val)
        values["_coil_emergency"] = bool(SIM[device_id]["coils"].get(0, False))
    return {
        "ok": True,
        "deviceId": device_id,
        "values": values,
        "raw": raw_map,
        "source": SOURCE,
        "at": now(),
    }


class Handler(BaseHTTPRequestHandler):
    def _auth_ok(self):
        if not TOKEN:
            return True
        auth = self.headers.get("Authorization", "")
        return auth == f"Bearer {TOKEN}" or auth == TOKEN

    def _json(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        if code != 204:
            self.wfile.write(body)

    def do_OPTIONS(self):
        self._json(204, {})

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/health":
            return self._json(200, {
                "ok": True,
                "service": "aerovolt-modbus-gateway",
                "field": FIELD,
                "source": SOURCE,
                "at": now(),
                "devices_sim": list(SIM.keys()),
                "cyberdeck": False,
            })
        if path == "/architecture":
            return self._json(200, {**ARCH, "field": FIELD, "source": SOURCE, "at": now()})
        if path == "/log":
            return self._json(200, {"log": LOG[:50], "source": SOURCE})
        return self._json(404, {"error": "not found"})

    def do_POST(self):
        if not self._auth_ok():
            return self._json(401, {"error": "unauthorized"})
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            data = json.loads(raw.decode("utf-8") or "{}")
        except Exception:
            return self._json(400, {"error": "invalid json"})
        path = urlparse(self.path).path
        if path in ("/api/shutdown", "/modbus/emergency"):
            return self._emergency(data)
        if path == "/modbus/read":
            out = read_device_payload(data.get("device") or {})
            log("read", device=out.get("deviceId"), source=SOURCE)
            return self._json(200, out)
        if path == "/modbus/telemetry":
            devices = data.get("devices") or []
            snap = [read_device_payload(d) for d in devices]
            log("telemetry", count=len(snap), source=SOURCE)
            return self._json(200, {
                "ok": True, "source": SOURCE, "at": now(),
                "count": len(snap), "devices": snap,
            })
        return self._json(404, {"error": "not found"})

    def _emergency(self, data):
        equipment_id = data.get("equipmentId") or "ALL"
        value = data.get("value", True)
        if isinstance(value, str):
            value = value.lower() in ("1", "true", "yes", "on")
        devices = data.get("devices") or []
        emergency = data.get("emergency") or {}
        address = int(emergency.get("address") or (data.get("modbus") or {}).get("coilShutdown") or 0)
        if not devices:
            mb = data.get("modbus") or {}
            host = mb.get("host") or "127.0.0.1"
            if equipment_id == "ALL":
                devices = [
                    {"id": "INV-01", "host": host, "unitId": 1},
                    {"id": "INV-02", "host": host, "unitId": 2},
                    {"id": "INV-04", "host": host, "unitId": 4},
                ]
            else:
                devices = [{"id": equipment_id, "host": host, "unitId": int(mb.get("unitId") or 1)}]
        results = []
        with LOCK:
            for dev in devices:
                did = dev.get("id") or "DEV"
                host = dev.get("host") or "127.0.0.1"
                unit_id = int(dev.get("unitId") or 1)
                ensure_device(did)
                phys_ok, phys_msg = (False, "sim only")
                if FIELD:
                    phys_ok, phys_msg = try_write_coil(host, unit_id, address, bool(value))
                SIM[did]["coils"][address] = bool(value)
                if value:
                    SIM[did]["holding"][110] = 3
                    SIM[did]["holding"][100] = 0
                results.append({
                    "deviceId": did, "coil": address, "value": bool(value),
                    "physical": phys_ok, "detail": phys_msg,
                })
        log("emergency", equipmentId=equipment_id, value=value, results=results)
        ok = True if not FIELD else any(r["physical"] for r in results)
        return self._json(200 if ok or not FIELD else 502, {
            "ok": True if not FIELD else ok,
            "mode": "FIELD" if FIELD else "DEMO",
            "source": SOURCE,
            "at": now(),
            "results": results,
        })

    def log_message(self, fmt, *args):
        return


def main():
    log("gateway_start", host=HOST, port=PORT, field=FIELD, source=SOURCE)
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"AEROVOLT Modbus Gateway http://{HOST}:{PORT} source={SOURCE} FIELD={FIELD}")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
