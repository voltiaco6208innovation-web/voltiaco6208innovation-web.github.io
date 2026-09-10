-- AEROVOLT O&M — Schema predictivo + cola robótica + finanzas (JARVIS v2)
-- PostgreSQL / Timescale. La web DEMO usa el equivalente en js/jarvis-core.js

CREATE TABLE IF NOT EXISTS predicciones_falla_jarvis (
    id VARCHAR(50) PRIMARY KEY,
    inversor_id VARCHAR(50),
    probabilidad_falla NUMERIC(5,2),
    tiempo_estimado_paro_mins INT,
    metrica_anomala VARCHAR(50),
    planta_id VARCHAR(50),
    sector VARCHAR(10),
    days_to_clean INT,
    days_to_fail INT,
    ml_slope NUMERIC(12,6),
    ml_mode VARCHAR(40) DEFAULT 'ML_STUB_LINEAR_REGRESSION',
    fecha_prediccion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(20) DEFAULT 'DEMO'
);

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

-- Incidentes: columnas financieras (ejecutar si la tabla ya existe)
-- ALTER TABLE incidentes ADD COLUMN IF NOT EXISTS tarifa_aplicada_usd_kwh NUMERIC(6,4) DEFAULT 0.12;
-- ALTER TABLE incidentes ADD COLUMN IF NOT EXISTS costo_financiero_acumulado_usd NUMERIC(12,2) DEFAULT 0.0;
-- ALTER TABLE incidentes ADD COLUMN IF NOT EXISTS perdida_estimada_mwh NUMERIC(12,4) DEFAULT 0.0;
-- ALTER TABLE incidentes ADD COLUMN IF NOT EXISTS true_financial_yield_usd NUMERIC(12,2) DEFAULT 0.0;
-- ALTER TABLE incidentes ADD COLUMN IF NOT EXISTS tipo_falla VARCHAR(50);
