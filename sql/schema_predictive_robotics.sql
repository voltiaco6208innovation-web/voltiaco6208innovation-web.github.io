-- AEROVOLT O&M — Schema predictivo + cola robótica + finanzas de incidentes
-- Para PostgreSQL / Timescale (producción). Hoy la web usa DEMO en JS equivalente.
-- source de verdad futura: API + esta BD.

-- Tabla para almacenar patrones de pre-falla (Predicción Inteligente)
CREATE TABLE IF NOT EXISTS predicciones_falla_jarvis (
    id VARCHAR(50) PRIMARY KEY,
    inversor_id VARCHAR(50),
    probabilidad_falla NUMERIC(5,2),
    tiempo_estimado_paro_mins INT,
    metrica_anomala VARCHAR(50),
    planta_id VARCHAR(50),
    sector VARCHAR(10),
    fecha_prediccion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(20) DEFAULT 'DEMO'
);

-- Cola de misiones automatizadas para Hardware Robótico (Drones/Orugas)
CREATE TABLE IF NOT EXISTS cola_misiones_roboticas (
    id VARCHAR(50) PRIMARY KEY,
    planta_id VARCHAR(50),
    tipo_robot VARCHAR(20),
    coordenadas_destino_xyz VARCHAR(100),
    estado_mision VARCHAR(20) DEFAULT 'WAITING_HARDWARE',
    token_autenticacion VARCHAR(64),
    inversor_id VARCHAR(50),
    incident_id VARCHAR(50),
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(20) DEFAULT 'DEMO'
);

-- Finanzas en incidentes (si la tabla incidentes ya existe en backend)
-- ALTER TABLE incidentes ADD COLUMN IF NOT EXISTS tarifa_aplicada_usd_kwh NUMERIC(6,4) DEFAULT 0.12;
-- ALTER TABLE incidentes ADD COLUMN IF NOT EXISTS costo_financiero_acumulado_usd NUMERIC(12,2) DEFAULT 0.0;
-- ALTER TABLE incidentes ADD COLUMN IF NOT EXISTS perdida_estimada_mwh NUMERIC(12,4) DEFAULT 0.0;
-- ALTER TABLE incidentes ADD COLUMN IF NOT EXISTS tipo_falla VARCHAR(50);

-- Índice útil para no duplicar alertas de suciedad abiertas
-- CREATE INDEX IF NOT EXISTS idx_inc_soil_open ON incidentes (inversor_id) WHERE tipo_falla = 'PERDIDA_SUCIEDAD' AND estado != 'CLOSED';
