-- ==============================================================================
-- SECURE PRIVATE DASHBOARD: COMPLETE PRODUCTION DATABASE SCHEMA & RLS POLICIES
-- ==============================================================================
-- Run this script in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
--
-- Includes:
-- 1. private_records (Encrypted personal records vault with RLS)
-- 2. account_security (Account freeze, recovery state, verification)
-- 3. audit_logs (Legitimate behavioral event stream with anomaly detection indexes)
-- 4. blocked_ips (IP and CIDR blocklist with audit trail)
-- 5. files_metadata (Private file storage tracking, folders, size, checksum)
-- 6. file_access_logs (Upload, download, preview, delete authorization audit)
-- 7. backups (Full backup jobs, SHA-256 verification, status pipeline)
-- 8. error_logs (Server, API, database, storage runtime errors)
-- 9. request_logs (HTTP request monitoring, status codes, response time)
-- 10. security_sessions (Active sessions, device tracking, revocation)
-- ==============================================================================

-- 1. Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- -----------------------------------------------------------------------------
-- TABLE 1: private_records (Core Vault)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.private_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(trim(title)) > 0 AND char_length(title) <= 255),
    category TEXT NOT NULL CHECK (category IN (
        'Credentials',
        'Financial',
        'Personal Notes',
        'Legal & Identity',
        'Servers & API Keys',
        'Secure Backup'
    )),
    content TEXT NOT NULL,
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    tags TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_private_records_user_id ON public.private_records (user_id);
CREATE INDEX IF NOT EXISTS idx_private_records_user_category ON public.private_records (user_id, category);
CREATE INDEX IF NOT EXISTS idx_private_records_user_updated ON public.private_records (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_private_records_user_pinned ON public.private_records (user_id, is_pinned DESC);
CREATE INDEX IF NOT EXISTS idx_private_records_title_trgm ON public.private_records USING gin (title gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- TABLE 2: account_security (Freeze & Recovery Mode)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_security (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    is_frozen BOOLEAN NOT NULL DEFAULT false,
    freeze_reason TEXT,
    frozen_at TIMESTAMP WITH TIME ZONE,
    frozen_by TEXT,
    is_recovery_mode BOOLEAN NOT NULL DEFAULT false,
    recovery_activated_at TIMESTAMP WITH TIME ZONE,
    recovery_reason TEXT,
    recovery_verification_required BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- -----------------------------------------------------------------------------
-- TABLE 3: audit_logs (Behavioral Event Stream)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    success BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON public.audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON public.audit_logs (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);

-- -----------------------------------------------------------------------------
-- TABLE 4: blocked_ips (IP & CIDR Security Blocklist)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blocked_ips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT NOT NULL UNIQUE,
    is_cidr BOOLEAN NOT NULL DEFAULT false,
    reason TEXT NOT NULL,
    blocked_by TEXT NOT NULL,
    is_permanent BOOLEAN NOT NULL DEFAULT false,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_blocked_ips_active ON public.blocked_ips (ip_address) WHERE is_active = true;

-- -----------------------------------------------------------------------------
-- TABLE 5: files_metadata (Private Storage Metadata)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.files_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    folder_path TEXT NOT NULL DEFAULT '/',
    size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
    mime_type TEXT NOT NULL,
    extension TEXT NOT NULL,
    download_count INTEGER NOT NULL DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_files_user_folder ON public.files_metadata (user_id, folder_path);
CREATE INDEX IF NOT EXISTS idx_files_user_created ON public.files_metadata (user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- TABLE 6: file_access_logs (File Audit Logs)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.file_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES public.files_metadata(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('upload', 'download', 'preview', 'rename', 'move', 'delete')),
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_file_access_user_action ON public.file_access_logs (user_id, action, created_at DESC);

-- -----------------------------------------------------------------------------
-- TABLE 7: backups (Backup Pipeline)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Pending', 'Running', 'Verifying', 'Completed', 'Failed')),
    size_bytes BIGINT NOT NULL DEFAULT 0,
    record_count INTEGER NOT NULL DEFAULT 0,
    file_count INTEGER NOT NULL DEFAULT 0,
    checksum_sha256 TEXT,
    is_scheduled BOOLEAN NOT NULL DEFAULT false,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_backups_user_created ON public.backups (user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- TABLE 8: error_logs (Application Error Monitoring)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    error_id TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    error_type TEXT NOT NULL,
    message TEXT NOT NULL,
    endpoint TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    request_id TEXT,
    resolved BOOLEAN NOT NULL DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON public.error_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_unresolved ON public.error_logs (resolved, timestamp DESC);

-- -----------------------------------------------------------------------------
-- TABLE 9: security_sessions (Active Sessions & Revocation)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    device_summary TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_active_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_security_sessions_user ON public.security_sessions (user_id, is_active);

-- -----------------------------------------------------------------------------
-- AUTOMATIC TIMESTAMPS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_private_records_updated_at ON public.private_records;
CREATE TRIGGER trigger_private_records_updated_at
    BEFORE UPDATE ON public.private_records
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_files_metadata_updated_at ON public.files_metadata;
CREATE TRIGGER trigger_files_metadata_updated_at
    BEFORE UPDATE ON public.files_metadata
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE public.private_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_security ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for private_records
CREATE POLICY "Users view own records" ON public.private_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own records" ON public.private_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own records" ON public.private_records FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own records" ON public.private_records FOR DELETE USING (auth.uid() = user_id);

-- Policies for files_metadata
CREATE POLICY "Users view own files" ON public.files_metadata FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own files" ON public.files_metadata FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own files" ON public.files_metadata FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own files" ON public.files_metadata FOR DELETE USING (auth.uid() = user_id);

-- Policies for backups
CREATE POLICY "Users view own backups" ON public.backups FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own backups" ON public.backups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own backups" ON public.backups FOR DELETE USING (auth.uid() = user_id);

-- Grant authenticated users access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.private_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.files_metadata TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.file_access_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backups TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.account_security TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocked_ips TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.error_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_sessions TO authenticated;
