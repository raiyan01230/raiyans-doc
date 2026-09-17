import React, { useState } from 'react';
import { X, Copy, Check, Shield, Database, Lock, FileCode, CheckCircle2 } from 'lucide-react';

interface SetupGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  isConfigured: boolean;
}

const SQL_SCHEMA = `-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. Create the private_records table
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

-- 3. Create database indexes for rapid search
CREATE INDEX IF NOT EXISTS idx_private_records_user_id ON public.private_records (user_id);
CREATE INDEX IF NOT EXISTS idx_private_records_user_category ON public.private_records (user_id, category);
CREATE INDEX IF NOT EXISTS idx_private_records_user_updated ON public.private_records (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_private_records_title_trgm ON public.private_records USING gin (title gin_trgm_ops);

-- 4. Automatically maintain updated_at timestamp
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
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.private_records ENABLE ROW LEVEL SECURITY;

-- Policy 1: SELECT
DROP POLICY IF EXISTS "Users can only view their own records" ON public.private_records;
CREATE POLICY "Users can only view their own records"
    ON public.private_records FOR SELECT USING (auth.uid() = user_id);

-- Policy 2: INSERT
DROP POLICY IF EXISTS "Users can only insert their own records" ON public.private_records;
CREATE POLICY "Users can only insert their own records"
    ON public.private_records FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy 3: UPDATE
DROP POLICY IF EXISTS "Users can only update their own records" ON public.private_records;
CREATE POLICY "Users can only update their own records"
    ON public.private_records FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policy 4: DELETE
DROP POLICY IF EXISTS "Users can only delete their own records" ON public.private_records;
CREATE POLICY "Users can only delete their own records"
    ON public.private_records FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.private_records TO authenticated;`;

const ENV_SNIPPET = `# Access Credentials (Username is dynamic, defaults to raiyan)
ADMIN_USERNAME=raiyan
ADMIN_CODE=Raiyan77889

# Supabase Project Settings -> API
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...`;

export const SetupGuideModal: React.FC<SetupGuideModalProps> = ({
  isOpen,
  onClose,
  isConfigured,
}) => {
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [activeTab, setActiveTab] = useState<'schema' | 'env' | 'security'>('schema');

  if (!isOpen) return null;

  const copyToClipboard = (text: string, type: 'sql' | 'env') => {
    navigator.clipboard.writeText(text);
    if (type === 'sql') {
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
    } else {
      setCopiedEnv(true);
      setTimeout(() => setCopiedEnv(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        id="setup-guide-modal"
        className="relative w-full max-w-3xl bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-300">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
                Supabase Schema & Security Setup
                {isConfigured ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-300">
                    <CheckCircle2 className="w-3 h-3" /> Live Connected
                  </span>
                ) : (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-950/80 border border-amber-800 text-amber-300">
                    Sandbox Preview
                  </span>
                )}
              </h2>
              <p className="text-xs text-neutral-400">
                Production database table, RLS isolation policies, and environment setup
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-neutral-800 bg-neutral-950 px-6 gap-2 pt-2">
          <button
            onClick={() => setActiveTab('schema')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'schema'
                ? 'border-neutral-200 text-neutral-100'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            PostgreSQL Schema & RLS
          </button>
          <button
            onClick={() => setActiveTab('env')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'env'
                ? 'border-neutral-200 text-neutral-100'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            Environment Variables
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'security'
                ? 'border-neutral-200 text-neutral-100'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Security & Robots.txt
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {activeTab === 'schema' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-neutral-300">
                  Run this SQL in your Supabase dashboard (<span className="font-mono text-neutral-400">SQL Editor &gt; New Query</span>).
                  It enforces strict Row Level Security so no user can ever query or modify records belonging to another account.
                </p>
                <button
                  onClick={() => copyToClipboard(SQL_SCHEMA, 'sql')}
                  className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 flex items-center gap-1.5 shrink-0 transition-colors font-mono cursor-pointer"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied SQL</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy SQL</span>
                    </>
                  )}
                </button>
              </div>

              <div className="relative rounded-lg bg-neutral-950 border border-neutral-800 p-4 font-mono text-[11px] leading-relaxed text-neutral-300 overflow-x-auto max-h-[380px]">
                <pre>{SQL_SCHEMA}</pre>
              </div>
            </div>
          )}

          {activeTab === 'env' && (
            <div className="space-y-4">
              <p className="text-neutral-300">
                To link your Supabase project, provide these environment variables in your deployment or <span className="font-mono text-neutral-400">.env.local</span>:
              </p>

              <div className="relative rounded-lg bg-neutral-950 border border-neutral-800 p-4 font-mono text-[11px] leading-relaxed text-neutral-300">
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-neutral-800/80">
                  <span className="text-neutral-400">.env.local</span>
                  <button
                    onClick={() => copyToClipboard(ENV_SNIPPET, 'env')}
                    className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 flex items-center gap-1 text-[11px] font-mono cursor-pointer"
                  >
                    {copiedEnv ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedEnv ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <pre>{ENV_SNIPPET}</pre>
              </div>

              <div className="p-3 rounded-lg bg-neutral-800/40 border border-neutral-700/50 space-y-1.5 text-neutral-300">
                <div className="font-semibold text-neutral-200 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" /> Key Security Protections
                </div>
                <ul className="list-disc pl-5 space-y-1 text-neutral-400 text-[11px]">
                  <li>The <code className="text-neutral-200">SUPABASE_SERVICE_ROLE_KEY</code> is NEVER transmitted to or bundled into browser client code.</li>
                  <li>All database searches and mutations pass through authenticated server routes that verify the JWT bearer token.</li>
                  <li>User identity is derived strictly from the verified session, never from client-provided user IDs.</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-lg bg-neutral-950 border border-neutral-800 space-y-2">
                <h3 className="font-semibold text-neutral-200 text-xs flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" /> Google Discoverability & Zero Data Leakage
                </h3>
                <p className="text-neutral-400 leading-relaxed">
                  As requested, the website allows search engine discovery of the public login portal, while strictly protecting private records:
                </p>
                <div className="font-mono text-[11px] bg-neutral-900 p-2.5 rounded border border-neutral-800 text-neutral-300">
                  <div className="text-neutral-500"># public/robots.txt</div>
                  <div>User-agent: *</div>
                  <div>Allow: /$</div>
                  <div>Disallow: /api/</div>
                  <div>Disallow: /dashboard/</div>
                  <div>Disallow: /records/</div>
                  <div>Disallow: /*?*</div>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-neutral-950 border border-neutral-800 space-y-2 text-neutral-300">
                <h3 className="font-semibold text-neutral-200 text-xs">Security Hardening Measures Active:</h3>
                <ul className="list-disc pl-5 space-y-1 text-neutral-400 text-[11px]">
                  <li><strong className="text-neutral-300">Sliding Window Rate Limiter:</strong> API routes protected against brute-force attacks.</li>
                  <li><strong className="text-neutral-300">Cache-Control Directives:</strong> API responses flagged with <code className="text-neutral-300">no-store, no-cache</code> to prevent intermediate proxy/browser caching.</li>
                  <li><strong className="text-neutral-300">Zero Client Database Dump:</strong> Searching queries the server/database directly using parameterized filters; the database is never downloaded into the client.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-800 bg-neutral-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-100 hover:bg-white text-neutral-950 font-medium rounded-lg text-xs transition-colors cursor-pointer"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
