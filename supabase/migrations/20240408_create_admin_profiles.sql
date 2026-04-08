-- 1. Crear la tabla de perfiles de administrador
CREATE TABLE IF NOT EXISTS public.admin_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'admin' CHECK (role IN ('superadmin', 'admin')),
    permissions JSONB DEFAULT '{"raffles": true, "participants": true, "analytics": true, "settings": true, "admins": false}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Habilitar RLS
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Seguridad
-- Los admins pueden ver todos los perfiles
CREATE POLICY "Admins can view all profiles" 
ON public.admin_profiles FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.admin_profiles WHERE id = auth.uid()));

-- Solo superadmins pueden insertar/editar otros admins
CREATE POLICY "Superadmins can manage admin profiles" 
ON public.admin_profiles FOR ALL 
USING (EXISTS (SELECT 1 FROM public.admin_profiles WHERE id = auth.uid() AND role = 'superadmin'));

-- 4. INSERT Inicial (SUPER ADMIN)
-- NOTA: Esto asume que el usuario ya existe en auth.users. 
-- Si no existe, se creará el perfil cuando el usuario se registre por primera vez.
-- Pero para asegurar el acceso, podemos insertar el correo en una tabla de "invitaciones" o manejarlo en el código.
-- Por ahora, insertaremos la whitelist.

-- Función para verificar si un correo es admin
CREATE OR REPLACE FUNCTION is_admin(email_to_check TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.admin_profiles WHERE email = email_to_check);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
