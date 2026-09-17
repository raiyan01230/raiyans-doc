import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { Request, Response } from 'express';
import multer from 'multer';
import { store, StoredFileMetadata, DEMO_USER_ID } from './store';
import { recordAuditEvent } from './monitoring';
import { getClientIp } from './security';

// Dangerous executable extensions strictly forbidden
const DISALLOWED_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'bash', 'ps1', 'vbs', 'dll', 'so', 'scr', 'com', 'msi', 'jar', 'reg', 'pif'
]);

// Configure Multer for in-memory upload buffering before secure validation
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB max
    files: 20, // up to 20 files per batch
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).replace('.', '').toLowerCase();
    if (DISALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error(`Security Violation: File extension .${ext} is restricted from upload.`));
    }
    cb(null, true);
  },
});

// Sanitize filename to prevent path traversal and unsafe characters
export function sanitizeFilename(filename: string): string {
  const base = path.basename(filename);
  return base.replace(/[^a-zA-Z0-9._\-+ ]/g, '_').trim() || 'unnamed_file';
}

// Sanitize folder path (e.g. "Work/Projects/../Confidential" -> "/Work/Confidential")
export function sanitizeFolderPath(rawPath?: string): string {
  if (!rawPath || rawPath === '/' || rawPath === '.') return '/';
  const clean = path.posix.normalize(rawPath.replace(/\\/g, '/')).replace(/^(\.\.(\/|$)|\/)+/, '');
  return clean ? `/${clean}` : '/';
}

// Format bytes into readable string
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// Generate permanent signed download/preview token (no automatic expiration, only removed on manual delete)
export function generateSignedFileToken(fileId: string): string {
  const token = `sig-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  store.signedUrlTokens.set(token, {
    fileId,
    expiresAt: Date.now() + 100 * 365 * 24 * 60 * 60 * 1000, // Permanent / 100 years
  });
  return token;
}

// Verify signed token
export function verifySignedFileToken(token: string): string | null {
  const data = store.signedUrlTokens.get(token);
  if (!data) return null;
  if (data.expiresAt && Date.now() > data.expiresAt) {
    store.signedUrlTokens.delete(token);
    return null;
  }
  return data.fileId;
}

// Check preview support
export function getPreviewType(mimeType: string, extension: string): 'image' | 'pdf' | 'text' | 'audio' | 'video' | 'unsupported' {
  const ext = extension.toLowerCase();
  const mime = mimeType.toLowerCase();

  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext) || mime.startsWith('image/')) {
    return 'image';
  }
  if (ext === 'pdf' || mime === 'application/pdf') {
    return 'pdf';
  }
  if (
    ['txt', 'csv', 'json', 'md', 'xml', 'log', 'yaml', 'yml'].includes(ext) ||
    mime.startsWith('text/') ||
    mime === 'application/json'
  ) {
    return 'text';
  }
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext) || mime.startsWith('audio/')) {
    return 'audio';
  }
  if (['mp4', 'webm'].includes(ext) || mime.startsWith('video/')) {
    return 'video';
  }
  return 'unsupported';
}
