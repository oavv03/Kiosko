-- =============================================================================
-- SCRIPT DE CREACIÓN DE TABLAS PARA SUPABASE (POSTGRESQL)
-- SISTEMA DE GESTIÓN DE TURNOS EN TIEMPO REAL - TRIBUNAL ELECTORAL DE PANAMÁ
-- =============================================================================

-- Habilitar extensión para generación automática de UUIDs si no está activa
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLA: REGIONALES (Sedes del Sistema)
-- Almacena las 16 sedes oficiales que operan de forma independiente
CREATE TABLE public.regionales (
    id VARCHAR(50) PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    ubicacion TEXT,
    config_pantallas VARCHAR(50) DEFAULT 'ALTERNADO' CHECK (config_pantallas IN ('INDEPENDIENTE', 'ALTERNADO')),
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Comentarios explicativos de la tabla
COMMENT ON TABLE public.regionales IS 'Sedes y Direcciones Regionales del Tribunal Electoral de Panamá';
COMMENT ON COLUMN public.regionales.config_pantallas IS 'Define si la sede tiene múltiples pantallas dedicadas (Ancón) o una sola alternada';


-- 2. TABLA: USUARIOS (Super Admins, Administradores y Funcionarios)
CREATE TABLE public.usuarios (
    id VARCHAR(50) PRIMARY KEY, -- ej: user-superadmin o UUID
    nombre VARCHAR(255) NOT NULL,
    usuario VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, -- Almacena el hash de la contraseña
    rol VARCHAR(50) NOT NULL DEFAULT 'FUNCIONARIO' CHECK (rol IN ('SUPER_ADMIN', 'ADMINISTRADOR', 'FUNCIONARIO', 'PANTALLA')),
    activo BOOLEAN DEFAULT TRUE,
    caja_asignada_id INTEGER, -- Relacionado con cajas
    sede_id VARCHAR(50) REFERENCES public.regionales(id) ON DELETE SET NULL,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.usuarios IS 'Personal administrativo y operativo que opera los módulos';


-- 3. TABLA: CAJAS (Ventanillas de Caja y Módulos de Triada)
-- Se inicializa con Caja 0 (Preferencial), Cajas 1 a 8 y Módulos de Triada 1 a 8 por sede
CREATE TABLE public.cajas (
    id INTEGER PRIMARY KEY, -- ID único absoluto por sede (ej: 1, 1001, 2001)
    numero INTEGER NOT NULL, -- Rango 0-8 o 1-8
    nombre VARCHAR(155) NOT NULL,
    estado VARCHAR(50) DEFAULT 'DESCONECTADA' CHECK (estado IN ('DISPONIBLE', 'OCUPADA', 'INACTIVA', 'DESCONECTADA')),
    tipo VARCHAR(50) DEFAULT 'CAJA' CHECK (tipo IN ('CAJA', 'TRIADA')),
    usuario_actual_id VARCHAR(50) REFERENCES public.usuarios(id) ON DELETE SET NULL,
    usuario_nombre VARCHAR(255),
    ticket_actual_id VARCHAR(100), -- ID del ticket que está atendiendo
    ticket_actual_codigo VARCHAR(50),
    ultima_actividad TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    activa BOOLEAN DEFAULT TRUE,
    sede_id VARCHAR(50) NOT NULL REFERENCES public.regionales(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.cajas IS 'Cubículos físicos y estaciones de trabajo de los operadores';


-- 4. TABLA: TICKETS (Turnos creados en Kiosco y derivados)
CREATE TABLE public.tickets (
    id VARCHAR(100) PRIMARY KEY, -- ID único del ticket autogenerado
    numero INTEGER NOT NULL, -- Correlativo numérico por serie (ej: 1, 2, 3...)
    codigo VARCHAR(50) NOT NULL, -- Código de turno (ej: C001, P-E002, T-001)
    tramite VARCHAR(155) NOT NULL, -- Cedulación, Extranjería, Registro Civil, etc.
    prefijo VARCHAR(10) NOT NULL, -- C, E, O, R
    ciudadano_nombre VARCHAR(150),
    ciudadano_apellido VARCHAR(150),
    estado VARCHAR(50) DEFAULT 'ESPERANDO' CHECK (estado IN ('ESPERANDO', 'ASIGNADO', 'LLAMANDO', 'EN_ATENCION', 'FINALIZADO', 'NO_PRESENTO', 'CANCELADO')),
    caja_id INTEGER REFERENCES public.cajas(id) ON DELETE SET NULL,
    caja_numero INTEGER,
    usuario_id VARCHAR(50) REFERENCES public.usuarios(id) ON DELETE SET NULL,
    usuario_nombre VARCHAR(255),
    etapa VARCHAR(50) DEFAULT 'CAJA' CHECK (etapa IN ('CAJA', 'TRIADA')),
    preferencial BOOLEAN DEFAULT FALSE,
    sede_id VARCHAR(50) NOT NULL REFERENCES public.regionales(id) ON DELETE CASCADE,
    
    -- Timestamps y tiempos de auditoría para KPIs
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_asignacion TIMESTAMP WITH TIME ZONE,
    fecha_llamado TIMESTAMP WITH TIME ZONE,
    fecha_inicio TIMESTAMP WITH TIME ZONE,
    fecha_finalizacion TIMESTAMP WITH TIME ZONE,
    
    llamados_contador INTEGER DEFAULT 0,
    modo_llamado VARCHAR(50) DEFAULT 'VOZ' CHECK (modo_llamado IN ('VOZ', 'PITIDO'))
);

COMMENT ON TABLE public.tickets IS 'Turnos generados por ciudadanos en el kiosco';


-- 5. TABLA: TRACKING_TICKET (Historial de Eventos de Tickets / Auditoría)
-- Permite un registro preciso de los tiempos y del tracking de los estados de un turno
CREATE TABLE public.tracking_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id VARCHAR(100) NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    tipo_evento VARCHAR(100) NOT NULL, -- TICKET_CREADO, TICKET_ASIGNADO, TICKET_LLAMADO, TICKET_FINALIZADO, etc.
    numero VARCHAR(50),
    codigo VARCHAR(50),
    caja INTEGER,
    caja_id INTEGER,
    funcionario VARCHAR(255),
    ciudadano VARCHAR(255),
    sede_id VARCHAR(50) REFERENCES public.regionales(id) ON DELETE CASCADE,
    payload JSONB, -- Información extra extendida del evento
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.tracking_tickets IS 'Bitácora detallada de eventos y trazabilidad (tracking) de cada turno';


-- =============================================================================
-- CREACIÓN DE ÍNDICES OPTIMIZADOS (Para consultas veloces en tiempo real y KPIs)
-- =============================================================================

CREATE INDEX idx_tickets_sede_estado ON public.tickets(sede_id, estado);
CREATE INDEX idx_tickets_fecha_creacion ON public.tickets(fecha_creacion);
CREATE INDEX idx_cajas_sede_estado ON public.cajas(sede_id, estado);
CREATE INDEX idx_tracking_ticket_id ON public.tracking_tickets(ticket_id);
CREATE INDEX idx_tracking_tipo_evento ON public.tracking_tickets(tipo_evento);


-- =============================================================================
-- SEED DATA: 16 REGIONALES DEL TRIBUNAL ELECTORAL DE PANAMÁ
-- =============================================================================

INSERT INTO public.regionales (id, nombre, ubicacion, config_pantallas) VALUES
('ancon', 'Tribunal Electoral de Panamá — Sede Principal de Ancón', 'Avenida Omar Torrijos Herrera, Ancón', 'INDEPENDIENTE'),
('bocas_del_toro', 'Dirección Regional de Bocas del Toro', 'Bocas del Toro, Panamá', 'ALTERNADO'),
('cocle', 'Dirección Regional de Coclé', 'Coclé, Panamá', 'ALTERNADO'),
('colon', 'Dirección Regional de Colón', 'Colón, Panamá', 'ALTERNADO'),
('chiriqui', 'Dirección Regional de Chiriquí', 'Chiriquí, Panamá', 'ALTERNADO'),
('darien', 'Dirección Regional de Darién', 'Darién, Panamá', 'ALTERNADO'),
('herrera', 'Dirección Regional de Herrera', 'Herrera, Panamá', 'ALTERNADO'),
('los_santos', 'Dirección Regional de Los Santos', 'Los Santos, Panamá', 'ALTERNADO'),
('panama_centro', 'Dirección Regional de Panamá Centro', 'Panamá Centro, Panamá', 'ALTERNADO'),
('panama_norte', 'Dirección Regional de Panamá Norte', 'Panamá Norte, Panamá', 'ALTERNADO'),
('panama_este', 'Dirección Regional de Panamá Este', 'Panamá Este, Panamá', 'ALTERNADO'),
('panama_oeste', 'Dirección Regional de Panamá Oeste', 'Panamá Oeste, Panamá', 'ALTERNADO'),
('san_miguelito', 'Dirección Regional de San Miguelito', 'San Miguelito, Panamá', 'ALTERNADO'),
('veraguas', 'Dirección Regional de Veraguas', 'Veraguas, Panamá', 'ALTERNADO'),
('guna_yala', 'Dirección Regional de Guna Yala', 'Guna Yala, Panamá', 'ALTERNADO'),
('arraijan', 'Regional Especial de Arraiján', 'Arraiján, Panamá', 'ALTERNADO')
ON CONFLICT (id) DO UPDATE SET 
    nombre = EXCLUDED.nombre,
    ubicacion = EXCLUDED.ubicacion,
    config_pantallas = EXCLUDED.config_pantallas;


-- =============================================================================
-- SEED DATA: SUPER ADMINISTRADOR DE FÁBRICA
-- =============================================================================

INSERT INTO public.usuarios (id, nombre, usuario, email, password, rol, activo, sede_id) VALUES
('user-superadmin', 'Super Administrador', 'superadmin', 'superadmin@institucion.gob', 'admin', 'SUPER_ADMIN', TRUE, 'ancon')
ON CONFLICT (id) DO NOTHING;
