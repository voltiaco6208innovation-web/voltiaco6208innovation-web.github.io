# AEROVOLT — Arquitectura Gateway Modbus IoT Industrial

**Alcance:** puente industrial en planta. **Cyberdeck descartado.**  
**No es SCADA completo:** es el borde (edge) que habla Modbus TCP y expone HTTP/JSON a la plataforma web O&M.

---

## 1. Por qué existe el gateway

El navegador **no** abre sockets Modbus (puerto 502) de forma segura ni fiable.

```
[ Navegador / GitHub Pages ]
        │  HTTPS / HTTP JSON
        ▼
[ Gateway Aerovolt ]  ← este servicio (PC industrial, NUC, Raspberry, VM en LAN planta)
        │  Modbus TCP :502
        ▼
[ Inversores / PLC / RTU / datalogger ]
```

Responsabilidades del gateway:

| Función | Descripción |
|---------|-------------|
| Lectura | Holding/input registers → métricas (kW, V, A, estado) |
| Escritura controlada | Coils/registers de interlock o señalización (política de planta) |
| Emergencia | Recibe orden O&M y escribe coil de trip si FIELD=1 |
| Traducción | Raw Modbus → JSON con scale/offset del mapa |
| Seguridad perimetral | Token, bind LAN, sin exponer 502 a Internet |
| Auditoría | Log de lecturas/escrituras |

**No hace (aún):** historización larga, multi-tenant cloud, control remoto masivo de setpoints sin autorización adicional.

---

## 2. Capas

```
┌─────────────────────────────────────────────────────────┐
│  CAPA A — Plataforma AEROVOLT O&M (web estática)         │
│  control-center · modbus.html · edge-core · om-data     │
│  Modo DEMO: no requiere gateway                         │
│  Modo FIELD: apunta webhook/gateway URL                 │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTP JSON
                           │ Authorization: Bearer <token>
┌──────────────────────────▼──────────────────────────────┐
│  CAPA B — Gateway HTTP (modbus_gateway.py)              │
│  :8750  /health /modbus/read /modbus/telemetry          │
│         /modbus/emergency /api/shutdown /log            │
│  DEMO: banco en memoria                                 │
│  FIELD: pymodbus → equipos                              │
└──────────────────────────┬──────────────────────────────┘
                           │ Modbus TCP
┌──────────────────────────▼──────────────────────────────┐
│  CAPA C — Campo industrial                              │
│  Inversores (unitId 1..N) · PLC · medidor · meteo RTU   │
│  Red OT aislada / VLAN planta                           │
└─────────────────────────────────────────────────────────┘

Opcional futuro:
  CAPA B+ → MQTT publish (aerovolt/plant/+/telemetry)
  CAPA B+ → buffer SQLite / envío a API cloud O&M
```

---

## 3. Modos de operación

| Variable | Valor | Comportamiento |
|----------|-------|----------------|
| `AEROVOLT_MODBUS_FIELD` | `0` (default) | **DEMO IoT:** simula coils/holding; seguro para laboratorio |
| `AEROVOLT_MODBUS_FIELD` | `1` | **FIELD:** pymodbus real a `host:502` |
| `AEROVOLT_GW_TOKEN` | vacío | Sin auth (solo LAN de confianza / lab) |
| `AEROVOLT_GW_TOKEN` | string | Exige `Authorization: Bearer …` |
| `AEROVOLT_GW_HOST` | `127.0.0.1` | Solo localhost |
| `AEROVOLT_GW_HOST` | `0.0.0.0` | Escucha en todas las interfaces (usar con firewall) |
| `AEROVOLT_GW_PORT` | `8750` | Puerto HTTP del gateway |

---

## 4. Mapa de registros (contrato de datos)

Definido en la web: `js/modbus-map.js` (y debe alinearse con el gateway).

Estructura por dispositivo:

```json
{
  "id": "INV-07",
  "host": "192.168.10.17",
  "unitId": 7,
  "registers": [
    { "key": "power_kw", "type": "holding", "address": 100, "scale": 0.1, "offset": 0, "unit": "kW" }
  ]
}
```

Emergencia (plantilla):

```json
{ "type": "coil", "address": 0, "value": true }
```

**Antes de FIELD real:** sustituir addresses por el manual del inversor/PLC. La plantilla genérica **no** es universal.

Conversión:

```
valor_ingeniería = raw * scale + offset
```

---

## 5. API HTTP del gateway

### GET `/health`
Estado del servicio, modo FIELD, devices en sim.

### GET `/log`
Últimos eventos de auditoría (memoria, ring buffer).

### POST `/modbus/read`
Body:
```json
{ "device": { "id": "INV-01", "host": "192.168.10.11", "unitId": 1, "registers": [ ... ] } }
```
Respuesta:
```json
{
  "ok": true,
  "deviceId": "INV-01",
  "values": { "power_kw": 78.0, "_coil_emergency": false },
  "raw": { "power_kw": 780 },
  "source": "DEMO" | "FIELD"
}
```

### POST `/modbus/telemetry`
Lee un lote de devices (lista) y devuelve snapshot para O&M / om-data adapter.

### POST `/modbus/emergency` y POST `/api/shutdown`
Compatible con `edge-core` webhookUrl.

Body mínimo (edge-core):
```json
{
  "action": "emergency_shutdown",
  "modbus": { "host": "192.168.10.11", "unitId": 1, "coilShutdown": 0 },
  "plantId": "PLT-001",
  "equipmentId": "ALL",
  "reason": "...",
  "operator": "..."
}
```

En **DEMO:** actualiza banco simulado.  
En **FIELD:** `write_coil` físico; si falla, HTTP 502 y log.

### Política de seguridad operativa (producto)
La web O&M actual prioriza **MONITOR → DETECT → ALARM → WO**.  
La escritura de emergencia en gateway es **opt-in FIELD** y debe quedar detrás de:
- red OT
- token
- confirmación humana en UI
- auditoría

No habilitar FIELD en Internet público.

---

## 6. Flujo IoT industrial típico (planta)

1. Gateway corre en host con acceso a VLAN de inversores.  
2. Poll cada N segundos (`pollIntervalMs` en cliente web o cron en gateway).  
3. `/modbus/telemetry` → adaptador futuro rellena `om-data` / API.  
4. Desviación PR → Incident Center (web).  
5. Operador ACK / Work Order (sin escribir Modbus).  
6. Solo emergencias autorizadas → `/api/shutdown` → coil.

```
Inversor --Modbus--> Gateway --JSON--> (futuro) API O&M --UI--> Control Center
                         |
                         +--> MQTT (opcional) aerovolt/plant/PLT-001/telemetry
```

---

## 7. Integración con la web Aerovolt

| Componente web | Uso del gateway |
|----------------|-----------------|
| `modbus.html` | Config URL, poll, trip coil DEMO/FIELD |
| `js/modbus-client.js` | Cliente HTTP al gateway |
| `js/modbus-map.js` | Mapa devices/registers |
| `js/edge-core.js` | `webhookUrl` → `/api/shutdown` |
| `emergency.html` | Orden emergencia |
| `control-center.html` / `om-data.js` | Hoy DEMO; mañana telemetría vía API alimentada por gateway |

---

## 8. Despliegue recomendado

**Laboratorio**
```bash
cd gateway
python3 modbus_gateway.py
# FIELD=0, host 127.0.0.1:8750
```

**Planta (mínimo)**
```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export AEROVOLT_MODBUS_FIELD=1
export AEROVOLT_GW_TOKEN='rotating-secret'
export AEROVOLT_GW_HOST=10.20.0.10   # IP en LAN OT/DMZ
export AEROVOLT_GW_PORT=8750
python3 modbus_gateway.py
```

Firewall:
- 502 solo entre gateway e inversores
- 8750 solo desde red de operadores / jump host
- 0 exposición a Internet

systemd (idea):
```ini
[Service]
Environment=AEROVOLT_MODBUS_FIELD=1
ExecStart=/opt/aerovolt/gateway/.venv/bin/python /opt/aerovolt/gateway/modbus_gateway.py
Restart=always
```

---

## 9. Roadmap gateway (sin Cyberdeck)

| Fase | Entrega |
|------|---------|
| Hecho | HTTP bridge, DEMO sim, FIELD pymodbus, emergency, log, CORS lab |
| Siguiente | `/modbus/telemetry` batch, config devices en JSON local |
| Luego | Publicación MQTT, persistencia corta, health por device |
| Luego | Adaptador → API O&M que reemplace `source: DEMO` en om-data |
| No ahora | Control remoto de setpoints masivos, breakers, sin dual-auth |

---

## 10. Resumen en una frase

**El gateway Aerovolt es el IoT industrial de borde: traduce Modbus TCP de la planta a JSON HTTP para O&M, con DEMO seguro por defecto y FIELD explícito cuando hay red OT, mapa real y token.**
