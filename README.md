# Aerovolt.IA HMO — sitio público (TEST)

**URL:** https://voltiaco6208innovation-web.github.io/

## Integrado
- Landing comercial + HMO (`agent.js`)
- Control Center / Monitor / Admin / Analytics / Planta 3D
- **edge-core** (`js/edge-core.js`): modo DEMO/FIELD, eventos, apagado de emergencia, visión 17h, térmica
- **emergency.html** — protocolo de apagado + auditoría
- **vision.html** — scheduler 17h e inspecciones
- **thermal.html** — stream HLS/MJPG + overlay

## Notas
- DEMO no corta hardware real.
- FIELD envía orden solo si hay webhook/gateway configurado.
- Visión usa modelo stub hasta conectar CV real.
- RTSP requiere gateway → HLS en el navegador.
- Cyberdeck descartado del alcance.
