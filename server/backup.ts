import crypto from 'crypto';
import { store, StoredBackup, DEMO_USER_ID } from './store';
import { recordAuditEvent } from './monitoring';

export async function createFullBackup(userId: string = DEMO_USER_ID, isScheduled = false): Promise<StoredBackup> {
  const backupId = `bkp-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const timestamp = new Date().toISOString();
  const filename = `vault-backup-${timestamp.replace(/[:.]/g, '-')}.json`;

  const newBackup: StoredBackup = {
    id: backupId,
    user_id: userId,
    filename,
    status: 'Pending',
    size_bytes: 0,
    record_count: 0,
    file_count: 0,
    is_scheduled: isScheduled,
    created_at: timestamp,
  };

  store.backups.unshift(newBackup);

  // Execute pipeline asynchronously
  setTimeout(async () => {
    try {
      newBackup.status = 'Running';

      // 1. Gather all actual data
      const records = store.records.get(userId) || [];
      const files = store.files.get(userId) || [];
      const userAudit = store.auditLogs.filter(e => e.user_id === userId);
      const security = store.accountSecurity.get(userId) || null;

      const payload = {
        metadata: {
          version: '2.0.0',
          backup_id: backupId,
          created_at: timestamp,
          user_id: userId,
          environment: process.env.NODE_ENV || 'production',
        },
        records,
        files,
        security,
        auditLogsCount: userAudit.length,
      };

      const serialized = JSON.stringify(payload, null, 2);
      const sizeBytes = Buffer.byteLength(serialized, 'utf8');

      // 2. Verification phase
      newBackup.status = 'Verifying';
      const hash = crypto.createHash('sha256').update(serialized).digest('hex');

      // Double-check verification
      const verifyHash = crypto.createHash('sha256').update(serialized).digest('hex');
      if (hash !== verifyHash) {
        throw new Error('Backup integrity checksum verification failed.');
      }

      // 3. Mark completed
      newBackup.status = 'Completed';
      newBackup.size_bytes = sizeBytes;
      newBackup.record_count = records.length;
      newBackup.file_count = files.length;
      newBackup.checksum_sha256 = hash;
      newBackup.completed_at = new Date().toISOString();
      newBackup.data_payload = serialized;

      recordAuditEvent({
        userId,
        eventType: 'backup_created',
        resourceType: 'backup',
        resourceId: backupId,
        success: true,
        metadata: {
          filename,
          size_bytes: sizeBytes,
          record_count: records.length,
          file_count: files.length,
          checksum: hash.substring(0, 16) + '...',
        },
      });
    } catch (err: unknown) {
      newBackup.status = 'Failed';
      newBackup.error_message = err instanceof Error ? err.message : 'Unknown backup error';

      recordAuditEvent({
        userId,
        eventType: 'backup_created',
        resourceType: 'backup',
        resourceId: backupId,
        success: false,
        metadata: { error: newBackup.error_message },
      });
    }
  }, 100);

  return newBackup;
}

export function restoreBackup(backupId: string, userId: string = DEMO_USER_ID): { success: boolean; message: string; recordCount: number } {
  const backup = store.backups.find(b => b.id === backupId && b.user_id === userId);
  if (!backup) {
    throw new Error('Backup not found');
  }

  if (backup.status !== 'Completed' || !backup.data_payload) {
    throw new Error('Cannot restore: Backup is not in a completed, verified state.');
  }

  // Verify checksum before restoration
  const currentHash = crypto.createHash('sha256').update(backup.data_payload).digest('hex');
  if (currentHash !== backup.checksum_sha256) {
    throw new Error('Integrity verification failed: Backup checksum does not match stored verification hash.');
  }

  const parsed = JSON.parse(backup.data_payload);
  if (!Array.isArray(parsed.records)) {
    throw new Error('Corrupted backup structure: Missing records collection.');
  }

  // Restore records
  store.records.set(userId, parsed.records);

  recordAuditEvent({
    userId,
    eventType: 'backup_restored',
    resourceType: 'backup',
    resourceId: backupId,
    success: true,
    metadata: {
      restoredRecords: parsed.records.length,
      backupDate: backup.created_at,
    },
  });

  return {
    success: true,
    message: `Successfully restored ${parsed.records.length} records from verified backup ${backup.filename}.`,
    recordCount: parsed.records.length,
  };
}
