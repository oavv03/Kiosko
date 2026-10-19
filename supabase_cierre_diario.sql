-- =============================================================================
-- MIGRACIÓN SUPABASE: CIERRE DIARIO, HISTORIAL CENTRALIZADO Y STORAGE
-- SISTEMA DE GESTIÓN DE TURNOS EN TIEMPO REAL - TRIBUNAL ELECTORAL DE PANAMÁ
-- =============================================================================

-- 1. TABLA: CIERRES_DIARIOS (Control de Cierres de Jornada e Historial)
CREATE TABLE IF NOT EXISTS public.cierres_diarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fecha DATE NOT NULL UNIQUE, -- YYYY-MM-DD en America/Panama
    total_tickets INTEGER NOT NULL DEFAULT 0,
    archivo_path TEXT NOT NULL, -- ej: historial/2026/10/16/tickets.json
    bucket VARCHAR(100) NOT NULL DEFAULT 'historial-turnos',
    tamano_bytes BIGINT DEFAULT 0,
    estado VARCHAR(50) NOT NULL DEFAULT 'EXITOSO' CHECK (estado IN ('EXITOSO', 'ERROR', 'EN_PROCESO')),
    error_mensaje TEXT,
    sedes_procesadas JSONB,
    metadatos JSONB,
    ejecutado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.cierres_diarios IS 'Bitácora centralizada de cierres diarios automáticos y respaldo en Supabase Storage';
COMMENT ON COLUMN public.cierres_diarios.fecha IS 'Fecha oficial de la jornada cerrada según zona horaria America/Panama';
COMMENT ON COLUMN public.cierres_diarios.archivo_path IS 'Ruta del archivo JSON persistente en Supabase Storage';

CREATE INDEX IF NOT EXISTS idx_cierres_diarios_fecha ON public.cierres_diarios(fecha);
CREATE INDEX IF NOT EXISTS idx_cierres_diarios_estado ON public.cierres_diarios(estado);

-- 2. AJUSTE DE RESTRICCIÓN DE AUDITORÍA (TRACKING_TICKETS)
-- Evita que la limpieza de turnos viejos en la tabla 'tickets' borre en cascada
-- los registros de auditoría de tracking_tickets.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'tracking_tickets_ticket_id_fkey'
        AND table_name = 'tracking_tickets'
    ) THEN
        ALTER TABLE public.tracking_tickets DROP CONSTRAINT tracking_tickets_ticket_id_fkey;
        ALTER TABLE public.tracking_tickets ALTER COLUMN ticket_id DROP NOT NULL;
        ALTER TABLE public.tracking_tickets ADD CONSTRAINT tracking_tickets_ticket_id_fkey 
            FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. POLÍTICAS RLS (Row Level Security) PARA CIERRES_DIARIOS
ALTER TABLE public.cierres_diarios ENABLE ROW LEVEL SECURITY;

-- Lectura permitida a usuarios autenticados / supervisores / roles del sistema
DROP POLICY IF EXISTS "Lectura de cierres diarios permitida" ON public.cierres_diarios;
CREATE POLICY "Lectura de cierres diarios permitida" ON public.cierres_diarios
    FOR SELECT USING (true);

-- Inserción / modificación reservada exclusivamente al service_role
DROP POLICY IF EXISTS "Modificación exclusiva service_role" ON public.cierres_diarios;
CREATE POLICY "Modificación exclusiva service_role" ON public.cierres_diarios
    FOR ALL USING (auth.role() = 'service_role');

-- 4. BUCKET DE SUPABASE STORAGE: 'historial-turnos'
-- Inserción segura del bucket en storage.buckets si no existe
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('historial-turnos', 'historial-turnos', false, 52428800, ARRAY['application/json'])
ON CONFLICT (id) DO NOTHING;

-- Política de lectura para Supabase Storage (Privado, lectura autorizada)
DROP POLICY IF EXISTS "Lectura de historial storage por usuarios autenticados" ON storage.objects;
CREATE POLICY "Lectura de historial storage por usuarios autenticados"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'historial-turnos' AND (auth.role() = 'authenticated' OR auth.role() = 'service_role'));

DROP POLICY IF EXISTS "Escritura de historial storage exclusiva service_role" ON storage.objects;
CREATE POLICY "Escritura de historial storage exclusiva service_role"
    ON storage.objects FOR ALL
    USING (bucket_id = 'historial-turnos' AND auth.role() = 'service_role');

-- 5. AUTOMATIZACIÓN MEDIANTE SUPABASE CRON (pg_cron)
-- Horarios de atención:
-- Sede principal: 7:00 a.m. a 3:00 p.m. (America/Panama)
-- Sedes regionales: 7:30 a.m. a 3:30 p.m. (America/Panama)
-- Horario programado: 3:35 p.m. America/Panama (20:35 UTC) de lunes a viernes
-- (20 horas UTC = 15 horas Panamá, ya que Panamá es UTC-5 todo el año).
--
-- Si la extensión pg_cron está habilitada en su proyecto Supabase, puede ejecutar:
--
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule(
--   'cierre_diario_panama',
--   '35 20 * * 1-5', -- 20:35 UTC = 3:35 PM America/Panama (Lunes a Viernes)
--   $$
--     -- Llamada a webhook o Edge Function de exportación y limpieza
--     -- (El servidor de Node.js también ejecuta esta tarea autónomamente)
--   $$
-- );
