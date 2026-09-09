# AEROVOLT Modbus Gateway

Puente HTTP ↔ Modbus para la web Aerovolt.

## DEMO

```bash
cd gateway
python modbus_gateway.py
```

Web: /modbus.html → gateway `http://127.0.0.1:8750` → Guardar → Leer todos.

Webhook emergencia: `http://127.0.0.1:8750/api/shutdown`

## FIELD

```bash
pip install -r requirements.txt
export AEROVOLT_MODBUS_FIELD=1
export AEROVOLT_GW_TOKEN='tu-token'
python modbus_gateway.py
```

## Endpoints

- GET /health
- GET /log
- POST /modbus/read
- POST /modbus/emergency
- POST /api/shutdown
