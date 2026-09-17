import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Private storage directory on disk for local file persistence
const LOCAL_STORAGE_DIR = path.join(process.cwd(), '.private_storage');
if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
  try {
    fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create private storage dir:', err);
  }
}

export interface DemoRecord {
  id: string;
  user_id: string;
  title: string;
  category: string;
  content: string;
  is_pinned: boolean;
  tags: string[];
  version?: number;
  sync_version?: number;
  last_modified_device_id?: string;
  last_modified_device_label?: string;
  created_at: string;
  updated_at: string;
}

export interface StoredAuditEvent {
  event_id: string;
  user_id: string;
  event_type: string;
  timestamp: string;
  ip_address: string;
  user_agent: string;
  device_id?: string;
  device_label?: string;
  device_summary?: string;
  session_id?: string;
  approx_location?: string;
  resource_type?: string;
  resource_id?: string;
  success: boolean;
  prev_hash?: string;
  hash?: string;
  metadata?: Record<string, unknown>;
}

export interface StoredBlockedIP {
  id: string;
  ip_address: string;
  is_cidr: boolean;
  reason: string;
  blocked_by: string;
  is_permanent: boolean;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface StoredFileMetadata {
  id: string;
  user_id: string;
  filename: string;
  original_name: string;
  file_path: string; // storage relative or disk filename
  folder_path: string;
  size_bytes: number;
  mime_type: string;
  extension: string;
  download_count: number;
  last_accessed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoredBackup {
  id: string;
  user_id: string;
  filename: string;
  status: 'Pending' | 'Running' | 'Verifying' | 'Completed' | 'Failed';
  size_bytes: number;
  record_count: number;
  file_count: number;
  checksum_sha256?: string;
  is_scheduled: boolean;
  error_message?: string;
  created_at: string;
  completed_at?: string;
  data_payload?: string; // encrypted or serialized JSON
}

export interface StoredErrorLog {
  id: string;
  error_id: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  error_type: string;
  message: string;
  endpoint?: string;
  user_id?: string;
  request_id?: string;
  resolved: boolean;
  resolved_at?: string;
  resolved_by?: string;
}

export interface StoredRequestLog {
  request_id: string;
  timestamp: string;
  method: string;
  route: string;
  status_code: number;
  duration_ms: number;
  response_size_bytes: number;
  user_id?: string;
  ip_address: string;
  user_agent: string;
  success: boolean;
  error_message?: string;
}

export interface StoredSecuritySession {
  id: string;
  user_id: string;
  token_hash: string;
  ip_address: string;
  user_agent: string;
  device_summary: string;
  is_active: boolean;
  last_active_at: string;
  created_at: string;
}

export interface StoredAccountSecurity {
  user_id: string;
  is_frozen: boolean;
  freeze_reason: string | null;
  frozen_at: string | null;
  frozen_by: string | null;
  is_recovery_mode: boolean;
  recovery_activated_at: string | null;
  recovery_reason: string | null;
  recovery_verification_required: boolean;
  updated_at: string;
}

export const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';

class DataStore {
  public records: Map<string, DemoRecord[]> = new Map();
  public auditLogs: StoredAuditEvent[] = [];
  public blockedIPs: StoredBlockedIP[] = [];
  public files: Map<string, StoredFileMetadata[]> = new Map();
  public backups: StoredBackup[] = [];
  public errorLogs: StoredErrorLog[] = [];
  public requestLogs: StoredRequestLog[] = [];
  public sessions: StoredSecuritySession[] = [];
  public accountSecurity: Map<string, StoredAccountSecurity> = new Map();
  public signedUrlTokens: Map<string, { fileId: string; expiresAt: number }> = new Map();

  constructor() {
    this.initDefaultData();
  }

  private initDefaultData() {
    // Seed initial demo records
    this.records.set(DEMO_USER_ID, [
      {
        id: 'rec-001',
        user_id: DEMO_USER_ID,
        title: 'Primary Production Cloud Database Access',
        category: 'Credentials',
        content: 'Host: db.prod.internal.net\nPort: 5432\nDatabase: core_vault\nUser: psql_admin\nPassphrase: [REDACTED_REGEN_3849xL#9!]\nSSL: verify-full\nClient Cert: /etc/ssl/certs/vault-ca.pem',
        is_pinned: true,
        tags: ['database', 'production', 'credentials'],
        created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
        updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
      {
        id: 'rec-002',
        user_id: DEMO_USER_ID,
        title: 'Emergency Server Recovery Keys & Root Passphrases',
        category: 'Servers & API Keys',
        content: 'SSH Key Fingerprint: SHA256:d8b2e7c9...\nBackup Bastion: ssh -i ~/.ssh/vault_id_ed25519 ops@10.0.4.12\nHardware Key Recovery PIN: 9284-0192-3841\nSecondary 2FA Seed: JBSWY3DPEHPK3PXP',
        is_pinned: true,
        tags: ['ssh', 'recovery', 'infrastructure'],
        created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
        updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      },
      {
        id: 'rec-003',
        user_id: DEMO_USER_ID,
        title: 'Offshore Corporate Banking & Wire Instructions',
        category: 'Financial',
        content: 'Institution: Canton Private Trust (Geneva)\nIBAN: CH93 0076 2011 6238 5291 0\nSWIFT / BIC: CPTBCH22\nBeneficiary: Private Asset Holdings LLC\nAudit Reference: VAULT-FIN-2026-Q3',
        is_pinned: false,
        tags: ['financial', 'banking', 'wire'],
        created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
        updated_at: new Date(Date.now() - 86400000 * 4).toISOString(),
      },
      {
        id: 'rec-004',
        user_id: DEMO_USER_ID,
        title: 'Confidential Patent Draft & Intellectual Property Filing',
        category: 'Legal & Identity',
        content: 'USPTO Application No: 63/928,104\nTitle: Cryptographic Zero-Knowledge Key Sharding\nFiling Attorney: Vance & Sterling LLP\nStatus: Provisional Accepted\nConfidentiality Agreement: NDA-2026-088',
        is_pinned: false,
        tags: ['patent', 'legal', 'ip'],
        created_at: new Date(Date.now() - 86400000 * 12).toISOString(),
        updated_at: new Date(Date.now() - 86400000 * 6).toISOString(),
      }
    ]);

    // Initial account security configuration
    this.accountSecurity.set(DEMO_USER_ID, {
      user_id: DEMO_USER_ID,
      is_frozen: false,
      freeze_reason: null,
      frozen_at: null,
      frozen_by: null,
      is_recovery_mode: false,
      recovery_activated_at: null,
      recovery_reason: null,
      recovery_verification_required: true,
      updated_at: new Date().toISOString()
    });

    // Seed one starter sample file for real file testing if none exists
    const sampleFileId = 'file-sample-001';
    const sampleFilePath = path.join(LOCAL_STORAGE_DIR, `${sampleFileId}.txt`);
    if (!fs.existsSync(sampleFilePath)) {
      try {
        fs.writeFileSync(sampleFilePath, 'CONFIDENTIAL VAULT SPECIFICATION\n\nSecurity Architecture: Zero-Knowledge\nAccess Mode: Authenticated Bearer\nEncryption: AES-GCM-256\nStorage Mode: Isolated Sandbox & Supabase Storage.\n', 'utf8');
      } catch (e) {
        console.error('Sample file write failed:', e);
      }
    }

    const stat = fs.existsSync(sampleFilePath) ? fs.statSync(sampleFilePath) : { size: 165 };
    this.files.set(DEMO_USER_ID, [
      {
        id: sampleFileId,
        user_id: DEMO_USER_ID,
        filename: 'vault_architecture.txt',
        original_name: 'vault_architecture.txt',
        file_path: `${sampleFileId}.txt`,
        folder_path: '/Documents',
        size_bytes: stat.size,
        mime_type: 'text/plain',
        extension: 'txt',
        download_count: 0,
        last_accessed_at: null,
        created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 12).toISOString(),
      }
    ]);

    // Add initial system startup audit log
    this.auditLogs.unshift({
      event_id: `evt-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      user_id: DEMO_USER_ID,
      event_type: 'security_setting_changed',
      timestamp: new Date().toISOString(),
      ip_address: '127.0.0.1',
      user_agent: 'PrivateServer/1.0',
      device_summary: 'Server Core',
      resource_type: 'server',
      resource_id: 'vault-core',
      success: true,
      metadata: { action: 'initial_vault_boot', mode: 'strict' }
    });
  }

  public getLocalStorageDir(): string {
    return LOCAL_STORAGE_DIR;
  }

  // Helper to save binary file to disk
  public saveFileToDisk(fileId: string, buffer: Buffer): string {
    const filename = `${fileId}.bin`;
    const filePath = path.join(LOCAL_STORAGE_DIR, filename);
    fs.writeFileSync(filePath, buffer);
    return filename;
  }

  // Helper to read file from disk
  public getFileBuffer(filename: string): Buffer | null {
    const filePath = path.join(LOCAL_STORAGE_DIR, filename);
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath);
  }

  public deleteFileFromDisk(filename: string): boolean {
    const filePath = path.join(LOCAL_STORAGE_DIR, filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

export const store = new DataStore();
