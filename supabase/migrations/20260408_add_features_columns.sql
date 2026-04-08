-- Migración: Añadir funciones de Números Bendecidos y Compra Mínima
-- Fecha: 2026-04-08

-- 1. Añadir columnas a la tabla raffles
ALTER TABLE public.raffles 
ADD COLUMN IF NOT EXISTS blessed_config JSONB DEFAULT '{"quantity": 0, "interval": 0}'::jsonb,
ADD COLUMN IF NOT EXISTS blessed_numbers INTEGER[] DEFAULT '{}'::integer[],
ADD COLUMN IF NOT EXISTS min_tickets INTEGER DEFAULT 1;

-- 2. Asegurar que todas las rifas existentes tengan is_paid = true (según el nuevo modelo)
UPDATE public.raffles SET is_paid = true WHERE is_paid = false OR is_paid IS NULL;

-- 3. Comentario para el desarrollador: 
-- Es posible que sea necesario refrescar el caché del esquema en el cliente de Supabase 
-- si el error "column not found" persiste inmediatamente después de aplicar esto.
