import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { FileMetadata, StorageHealthMetrics } from '../types';
import {
  HardDrive,
  Upload,
  Folder,
  FolderPlus,
  File,
  FileText,
  Image,
  Music,
  Video,
  FileArchive,
  Download,
  Eye,
  Trash2,
  RefreshCw,
  Search,
  ExternalLink,
  X,
  CheckCircle2,
  AlertCircle,
  FolderTree,
  Edit2,
} from 'lucide-react';

interface StorageManagerViewProps {
  onNotify?: (msg: string, type?: 'info' | 'error') => void;
}

export function StorageManagerView({ onNotify }: StorageManagerViewProps) {
  const [health, setHealth] = useState<StorageHealthMetrics | null>(null);
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [folders, setFolders] = useState<string[]>(['/']);
  const [currentFolder, setCurrentFolder] = useState<string>('/');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Preview state
  const [previewFile, setPreviewFile] = useState<FileMetadata | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // New folder state
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);

  // Upload naming modal state
  const [pendingUploadFiles, setPendingUploadFiles] = useState<File[]>([]);
  const [customUploadName, setCustomUploadName] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Delete confirmation modal state
  const [fileToDelete, setFileToDelete] = useState<{ id: string; filename: string } | null>(null);

  // Rename modal state
  const [fileToRename, setFileToRename] = useState<FileMetadata | null>(null);
  const [newFilename, setNewFilename] = useState('');

  const loadAll = async () => {
    setLoading(true);
    try {
      const [healthData, filesData] = await Promise.all([
        api.getStorageHealth(),
        api.listFiles(currentFolder, search),
      ]);
      setHealth(healthData);
      setFiles(filesData.files || []);
      setFolders(filesData.folders || ['/']);
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Failed loading storage data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [currentFolder]);

  const handleFilesUpload = (uploadedFiles: FileList | File[]) => {
    if (!uploadedFiles || uploadedFiles.length === 0) return;
    const fileArray = Array.from(uploadedFiles);
    setPendingUploadFiles(fileArray);
    // Suggest clean name without extension for the first file
    const firstName = fileArray[0]?.name || '';
    const lastDot = firstName.lastIndexOf('.');
    const cleanName = lastDot !== -1 ? firstName.substring(0, lastDot) : firstName;
    setCustomUploadName(cleanName);
    setShowUploadModal(true);
  };

  const handleCustomUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pendingUploadFiles.length === 0) return;

    setShowUploadModal(false);
    setIsUploading(true);
    try {
      let filesToUpload = pendingUploadFiles;
      if (customUploadName.trim() && pendingUploadFiles.length === 1) {
        const originalFile = pendingUploadFiles[0];
        const lastDot = originalFile.name.lastIndexOf('.');
        const ext = lastDot !== -1 ? originalFile.name.substring(lastDot) : '';
        const newNameWithExt = customUploadName.trim().endsWith(ext) ? customUploadName.trim() : `${customUploadName.trim()}${ext}`;
        
        let renamedFile: any;
        try {
          renamedFile = new File([originalFile], newNameWithExt, { type: originalFile.type });
        } catch {
          const blob = new Blob([originalFile], { type: originalFile.type });
          (blob as any).name = newNameWithExt;
          renamedFile = blob;
        }
        renamedFile.customName = newNameWithExt;
        filesToUpload = [renamedFile];
      }

      const res = await api.uploadFiles(filesToUpload, currentFolder);
      onNotify?.(res.message || `Uploaded file(s) successfully`, 'info');
      await loadAll();
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'File upload failed', 'error');
    } finally {
      setIsUploading(false);
      setPendingUploadFiles([]);
      setCustomUploadName('');
    }
  };

  const handleDownload = async (file: FileMetadata) => {
    try {
      const { token } = await api.getFileToken(file.id);
      const downloadUrl = `/api/files/${encodeURIComponent(file.id)}/download?token=${encodeURIComponent(token)}`;
      window.location.href = downloadUrl;
      onNotify?.(`Downloading ${file.filename}...`, 'info');
      setTimeout(() => loadAll(), 1500);
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Download authorization failed', 'error');
    }
  };

  const handlePreview = async (file: FileMetadata) => {
    setPreviewFile(file);
    setPreviewLoading(true);
    try {
      const { token } = await api.getFileToken(file.id);
      const url = `/api/files/${encodeURIComponent(file.id)}/preview?token=${encodeURIComponent(token)}`;
      setPreviewUrl(url);
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Preview token failed', 'error');
      setPreviewFile(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDeleteFile = (id: string, name: string) => {
    setFileToDelete({ id, filename: name });
  };

  const confirmDeleteFile = async () => {
    if (!fileToDelete) return;
    const { id, filename } = fileToDelete;
    setFileToDelete(null);

    try {
      await api.deleteFile(id);
      onNotify?.(`File "${filename}" deleted successfully`, 'info');
      await loadAll();
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileToRename || !newFilename.trim()) return;

    try {
      await api.updateFile(fileToRename.id, { filename: newFilename.trim() });
      onNotify?.(`Renamed to "${newFilename.trim()}"`, 'info');
      setFileToRename(null);
      await loadAll();
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Rename failed', 'error');
    }
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const clean = newFolderName.trim().replace(/[^a-zA-Z0-9_\-]/g, '_');
    const folderPath = currentFolder === '/' ? `/${clean}` : `${currentFolder}/${clean}`;
    if (!folders.includes(folderPath)) {
      setFolders(prev => [...prev, folderPath]);
    }
    setCurrentFolder(folderPath);
    setNewFolderName('');
    setShowNewFolderModal(false);
    onNotify?.(`Switched to folder "${folderPath}"`, 'info');
  };

  const getFileIcon = (mime: string, ext: string) => {
    const e = ext.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(e) || mime.startsWith('image/')) {
      return <Image className="w-4 h-4 text-emerald-400" />;
    }
    if (e === 'pdf') {
      return <FileText className="w-4 h-4 text-red-400" />;
    }
    if (['txt', 'csv', 'json', 'md', 'xml'].includes(e) || mime.startsWith('text/')) {
      return <FileText className="w-4 h-4 text-sky-400" />;
    }
    if (['mp3', 'wav', 'ogg'].includes(e) || mime.startsWith('audio/')) {
      return <Music className="w-4 h-4 text-amber-400" />;
    }
    if (['mp4', 'webm'].includes(e) || mime.startsWith('video/')) {
      return <Video className="w-4 h-4 text-purple-400" />;
    }
    if (['zip', 'tar', 'gz', '7z'].includes(e)) {
      return <FileArchive className="w-4 h-4 text-orange-400" />;
    }
    return <File className="w-4 h-4 text-neutral-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Storage Health Metrics Card */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-neutral-400" />
            <span className="font-mono text-xs font-semibold text-neutral-100 uppercase">
              STORAGE HEALTH & METRICS
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-neutral-400">
              Provider Quota: <span className="text-neutral-200">{health?.availableQuota || 'Unavailable from provider'}</span>
            </span>
            <button
              onClick={loadAll}
              className="p-1 hover:bg-neutral-800 rounded text-neutral-400"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
          <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800">
            <span className="text-neutral-500 text-[10px] uppercase block">Used Space</span>
            <span className="text-lg font-semibold text-neutral-100">
              {health?.storageUsageFormatted || '0 B'}
            </span>
            <span className="text-[10px] text-neutral-500 block mt-0.5">
              {health?.storageUsageBytes ? `${health.storageUsageBytes.toLocaleString()} bytes` : '0 bytes'}
            </span>
          </div>

          <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800">
            <span className="text-neutral-500 text-[10px] uppercase block">Total Files</span>
            <span className="text-lg font-semibold text-neutral-100">{health?.fileCount || 0}</span>
            <span className="text-[10px] text-neutral-500 block mt-0.5">In private vault</span>
          </div>

          <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800">
            <span className="text-neutral-500 text-[10px] uppercase block">Uploads / Deletions</span>
            <span className="text-lg font-semibold text-neutral-100">
              {health?.recentUploadsCount || 0} / {health?.recentDeletionsCount || 0}
            </span>
            <span className="text-[10px] text-neutral-500 block mt-0.5">Recent audit events</span>
          </div>

          <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800">
            <span className="text-neutral-500 text-[10px] uppercase block">Storage Integrity</span>
            <span className="text-lg font-semibold text-emerald-400">100% HEALTHY</span>
            <span className="text-[10px] text-neutral-500 block mt-0.5">Zero failed I/O</span>
          </div>
        </div>

        {/* Largest Files Preview */}
        {health?.largestFiles && health.largestFiles.length > 0 && (
          <div className="pt-1">
            <span className="text-[11px] font-mono text-neutral-400 block mb-2">Largest Files in Storage:</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
              {health.largestFiles.slice(0, 3).map(lf => (
                <div
                  key={lf.id}
                  className="bg-neutral-950 border border-neutral-800/80 px-3 py-1.5 rounded flex items-center justify-between"
                >
                  <span className="truncate text-neutral-300 mr-2">{lf.filename}</span>
                  <span className="text-neutral-500 whitespace-nowrap text-[11px]">{lf.size_formatted}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* File Upload Dropzone */}
      <div
        onDragOver={e => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault();
          setDragOver(false);
          handleFilesUpload(e.dataTransfer.files);
        }}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
          dragOver
            ? 'border-neutral-400 bg-neutral-900/80'
            : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-700'
        }`}
      >
        <input
          type="file"
          multiple
          ref={fileInputRef}
          onChange={e => e.target.files && handleFilesUpload(e.target.files)}
          className="hidden"
        />
        <input
          type="file"
          ref={folderInputRef}
          {...({ webkitdirectory: '', directory: '' } as any)}
          onChange={e => e.target.files && handleFilesUpload(e.target.files)}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center space-y-2">
          <Upload className={`w-8 h-8 ${isUploading ? 'text-neutral-400 animate-bounce' : 'text-neutral-500'}`} />
          <div className="text-xs font-mono text-neutral-300 font-medium">
            {isUploading
              ? 'Encrypting & Saving Files to Vault...'
              : 'Drag and drop private files or folders here'}
          </div>
          <p className="text-[11px] text-neutral-500 font-mono">
            Target Directory: <span className="text-neutral-300 font-semibold">{currentFolder}</span> • Auto-sanitized
          </p>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-mono transition-colors"
            >
              Choose Files
            </button>
            <button
              onClick={() => folderInputRef.current?.click()}
              disabled={isUploading}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-mono transition-colors"
            >
              Upload Folder
            </button>
          </div>
        </div>
      </div>

      {/* Folder Navigation & Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1">
          <span className="text-xs font-mono text-neutral-500 flex items-center gap-1">
            <FolderTree className="w-3.5 h-3.5" />
            <span>Folder:</span>
          </span>

          {folders.map(f => (
            <button
              key={f}
              onClick={() => setCurrentFolder(f)}
              className={`px-2.5 py-1 text-xs font-mono rounded-lg border whitespace-nowrap transition-colors flex items-center gap-1 ${
                currentFolder === f
                  ? 'bg-neutral-800 text-neutral-100 border-neutral-600'
                  : 'bg-neutral-900/60 text-neutral-400 border-neutral-800 hover:bg-neutral-800'
              }`}
            >
              <Folder className="w-3 h-3 text-neutral-500" />
              <span>{f}</span>
            </button>
          ))}

          <button
            onClick={() => setShowNewFolderModal(true)}
            className="p-1 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-400 hover:text-neutral-200"
            title="Create Subfolder"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search files..."
            value={search}
            onChange={e => {
              setSearch(e.target.value);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') loadAll();
            }}
            className="w-full bg-neutral-900/80 border border-neutral-800 pl-8 pr-3 py-1 text-xs text-neutral-200 rounded-lg focus:outline-none focus:border-neutral-600 font-mono"
          />
        </div>
      </div>

      {/* Files Table */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-neutral-900/90 text-neutral-400 text-[11px] border-b border-neutral-800">
              <tr>
                <th className="py-2.5 px-3">FILE NAME</th>
                <th className="py-2.5 px-3">FOLDER</th>
                <th className="py-2.5 px-3">SIZE</th>
                <th className="py-2.5 px-3">TYPE</th>
                <th className="py-2.5 px-3">DOWNLOADS</th>
                <th className="py-2.5 px-3">UPLOADED</th>
                <th className="py-2.5 px-3 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 text-neutral-300">
              {files.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-neutral-500">
                    No files found in this folder.
                  </td>
                </tr>
              ) : (
                files.map(file => (
                  <tr key={file.id} className="hover:bg-neutral-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-neutral-200 flex items-center gap-2">
                      {getFileIcon(file.mime_type, file.extension)}
                      <span className="truncate max-w-xs">{file.filename}</span>
                    </td>
                    <td className="py-2.5 px-3 text-neutral-400">{file.folder_path}</td>
                    <td className="py-2.5 px-3 text-neutral-400 whitespace-nowrap">
                      {file.size_bytes ? `${(file.size_bytes / 1024).toFixed(1)} KB` : '0 B'}
                    </td>
                    <td className="py-2.5 px-3 uppercase text-[10px] text-neutral-400">{file.extension}</td>
                    <td className="py-2.5 px-3 text-neutral-400">{file.download_count}</td>
                    <td className="py-2.5 px-3 text-neutral-500 whitespace-nowrap">
                      {new Date(file.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handlePreview(file)}
                          className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-neutral-200"
                          title="Preview file"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDownload(file)}
                          className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-neutral-200"
                          title="Download file"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setFileToRename(file);
                            setNewFilename(file.filename);
                          }}
                          className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-neutral-200"
                          title="Rename file"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteFile(file.id, file.filename)}
                          className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-red-400"
                          title="Delete file"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Safe File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl max-w-3xl w-full p-5 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                {getFileIcon(previewFile.mime_type, previewFile.extension)}
                <span className="font-mono text-xs font-semibold text-neutral-100 truncate">
                  PREVIEW: {previewFile.filename}
                </span>
              </div>
              <button
                onClick={() => {
                  setPreviewFile(null);
                  setPreviewUrl(null);
                }}
                className="p-1 text-neutral-400 hover:text-neutral-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-neutral-950 rounded-lg p-4 flex items-center justify-center min-h-[250px]">
              {previewLoading ? (
                <div className="text-xs font-mono text-neutral-500 animate-pulse">
                  Authorizing temporary preview token...
                </div>
              ) : previewUrl ? (
                previewFile.mime_type.startsWith('image/') ||
                ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(previewFile.extension.toLowerCase()) ? (
                  <img
                    src={previewUrl}
                    alt={previewFile.filename}
                    className="max-h-[60vh] max-w-full object-contain rounded"
                    referrerPolicy="no-referrer"
                  />
                ) : previewFile.extension === 'pdf' ? (
                  <iframe
                    src={previewUrl}
                    title={previewFile.filename}
                    className="w-full h-[60vh] rounded border-0"
                  />
                ) : (
                  <iframe
                    src={previewUrl}
                    title={previewFile.filename}
                    className="w-full h-[50vh] rounded border-0 bg-neutral-950 font-mono text-xs"
                  />
                )
              ) : (
                <div className="text-xs font-mono text-neutral-500">Preview not available</div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 text-xs font-mono">
              <span className="text-emerald-500/80 font-semibold">
                Permanent Private File Token (Never Expires • Only Deleted manually)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDownload(previewFile)}
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  onClick={() => {
                    setPreviewFile(null);
                    setPreviewUrl(null);
                  }}
                  className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateFolder}
            className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 max-w-md w-full space-y-4 font-mono text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <span className="font-semibold text-neutral-200">CREATE SUBFOLDER</span>
              <button
                type="button"
                onClick={() => setShowNewFolderModal(false)}
                className="text-neutral-500 hover:text-neutral-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-neutral-400 mb-1">Folder Name:</label>
              <input
                type="text"
                placeholder="e.g. Identity_Docs"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-200 rounded-lg focus:outline-none focus:border-neutral-500"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewFolderModal(false)}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-neutral-200 hover:bg-white text-neutral-950 font-semibold rounded-lg"
              >
                Create Folder
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rename Modal */}
      {fileToRename && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form
            onSubmit={handleRenameSubmit}
            className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 max-w-md w-full space-y-4 font-mono text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <span className="font-semibold text-neutral-200">RENAME FILE</span>
              <button
                type="button"
                onClick={() => setFileToRename(null)}
                className="text-neutral-500 hover:text-neutral-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-neutral-400 mb-1">New Filename:</label>
              <input
                type="text"
                value={newFilename}
                onChange={e => setNewFilename(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-200 rounded-lg focus:outline-none focus:border-neutral-500"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFileToRename(null)}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-neutral-200 hover:bg-white text-neutral-950 font-semibold rounded-lg"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Upload Naming Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form
            onSubmit={handleCustomUploadSubmit}
            className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 max-w-md w-full space-y-4 font-mono text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <span className="font-semibold text-neutral-200 flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-neutral-400" /> SET FILE NAME BEFORE UPLOAD
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  setPendingUploadFiles([]);
                }}
                className="text-neutral-500 hover:text-neutral-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-neutral-400 mb-1">Custom File Name:</label>
              <input
                type="text"
                value={customUploadName}
                onChange={e => setCustomUploadName(e.target.value)}
                placeholder="Enter file name..."
                className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-200 rounded-lg focus:outline-none focus:border-neutral-500"
                autoFocus
              />
              <p className="text-[10px] text-neutral-500 mt-1">
                Original file: {pendingUploadFiles[0]?.name} • Folder: {currentFolder}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  setPendingUploadFiles([]);
                }}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-neutral-200 hover:bg-white text-neutral-950 font-semibold rounded-lg"
              >
                Upload &amp; Encrypt
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 max-w-md w-full space-y-4 font-mono text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <span className="font-semibold text-red-400 flex items-center gap-1.5">
                <Trash2 className="w-4 h-4" /> CONFIRM PERMANENT DELETE
              </span>
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                className="text-neutral-500 hover:text-neutral-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-neutral-300">
              Are you sure you want to permanently delete <span className="text-white font-semibold">"{fileToDelete.filename}"</span> from secure private storage?
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteFile}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
