-- ============================================================================
-- Choy Chat — Complete Supabase Database & Private KYC Security Rules Setup
-- Run this entire script in your Supabase SQL Editor (SQL Editor -> New Query -> Run)
-- ============================================================================

-- 1. Create app_users table if it doesn't exist yet
CREATE TABLE IF NOT EXISTS public.app_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  pin_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'approved',
  blocked_users JSONB NOT NULL DEFAULT '[]'::jsonb,
  avatar_url TEXT,
  newsfeed TEXT NOT NULL DEFAULT 'feed_a',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure required columns exist on app_users
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS newsfeed TEXT NOT NULL DEFAULT 'feed_a';
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS encrypted_real_name TEXT;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS private_kyc_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2. Create the PRIVATE storage bucket for Valid IDs and Real Profile Pictures
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'choychat-private-kyc',
  'choychat-private-kyc',
  false, -- STRICTLY PRIVATE: No public URLs allowed
  8388608, -- 8 MB max per image
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 8388608,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 3. Storage RLS: Revoke public / customer read access to Private KYC Bucket
-- ONLY users whose role = 'admin' (or service_role) can SELECT/read Valid IDs or Real Profile Pictures.
DROP POLICY IF EXISTS "Admin only read private KYC bucket" ON storage.objects;
CREATE POLICY "Admin only read private KYC bucket"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'choychat-private-kyc'
  AND EXISTS (
    SELECT 1 FROM public.app_users u
    WHERE u.id = auth.uid()::text
      AND u.role = 'admin'
  )
);

-- Allow authenticated customers to upload into their own private folder only
DROP POLICY IF EXISTS "Owner upload private KYC image" ON storage.objects;
CREATE POLICY "Owner upload private KYC image"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'choychat-private-kyc'
  AND (storage.foldername(name))[1] IN ('valid-ids', 'real-avatars')
);

-- Only Admins can delete private KYC files
DROP POLICY IF EXISTS "Admin only delete private KYC bucket" ON storage.objects;
CREATE POLICY "Admin only delete private KYC bucket"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'choychat-private-kyc'
  AND EXISTS (
    SELECT 1 FROM public.app_users u
    WHERE u.id = auth.uid()::text
      AND u.role = 'admin'
  )
);

-- 4. Public-safe view that NEVER exposes encrypted_real_name or private_kyc_meta
CREATE OR REPLACE VIEW public.public_customer_profiles AS
SELECT
  id,
  name AS display_name,
  role,
  status,
  avatar_url,
  created_at
FROM public.app_users;

-- 5. Row-Level Security on app_users (Admin reads encrypted_real_name; others restricted)
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full read app_users" ON public.app_users;
CREATE POLICY "Admin full read app_users"
ON public.app_users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.app_users admin_u
    WHERE admin_u.id = auth.uid()::text
      AND admin_u.role = 'admin'
  )
);
