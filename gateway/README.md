# AEROVOLT Modbus Gateway (IoT industrial)

Puente **HTTP ↔ Modbus TCP** para la plataforma O&M.  
Documentación completa: [ARCHITECTURE.md](./ARCHITECTURE.md)

Cyberdeck: **fuera de alcance**.

## Arranque rápido (DEMO)

```bash
cd gateway
python3 modbus_gateway.py
# http://127.0.0.1:8750/health
```

En la web: [modbus.html](../modbus.html) → gateway `http://127.0.0.1:8750` → Guardar → Leer todos.

Webhook emergencia (edge-core): `http://127.0.0.1:8750/api/shutdown`

## FIELD (equipo real)

```bash
pip install -r requirements.txt
export AEROVOLT_MODBUS_FIELD=1
export AEROVOLT_GW_TOKEN='tu-token'
export AEROVOLT_GW_HOST=0.0.0.0   # solo en LAN confiable + firewall
python3 modbus_gateway.py
```

Ajustar hosts/unitId/registers en `../js/modbus-map.js` al manual del inversor.

## Endpoints

| Método | Ruta | Uso |
|--------|------|-----|
| GET | `/health` | Estado + modo FIELD |
| GET | `/architecture` | Resumen JSON de la arquitectura |
| GET | `/log` | Auditoría reciente |
| POST | `/modbus/read` | Leer un device |
| POST | `/modbus/telemetry` | Snapshot lote devices |
| POST | `/modbus/emergency` | Write coil emergencia |
| POST | `/api/shutdown` | Compatible edge-core webhook |

## Variables de entorno

| Var | Default | Significado |
|-----|---------|-------------|
| `AEROVOLT_GW_HOST` | `127.0.0.1` | Bind HTTP |
| `AEROVOLT_GW_PORT` | `8750` | Puerto HTTP |
| `AEROVOLT_GW_TOKEN` | vacío | Bearer token |
| `AEROVOLT_MODBUS_FIELD` | `0` | `1` = pymodbus real |

## Seguridad

- No exponer `:8750` ni `:502` a Internet.
- FIELD solo con mapa validado y autorización de planta.
- O&M web prioriza monitoreo; escritura es excepción controlada.
