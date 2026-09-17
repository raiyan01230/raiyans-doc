import React, { useState, useEffect } from 'react';
import { X, Lock, Pin, AlertCircle, Save, Code } from 'lucide-react';
import { CreateRecordInput, PrivateRecord, RECORD_CATEGORIES, RecordCategory } from '../types';

interface RecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateRecordInput) => Promise<void>;
  initialRecord?: PrivateRecord | null;
}

export const RecordModal: React.FC<RecordModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialRecord,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<RecordCategory>('Credentials');
  const [content, setContent] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [isMonospace, setIsMonospace] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialRecord) {
      setTitle(initialRecord.title);
      setCategory(initialRecord.category);
      setContent(initialRecord.content);
      setTagsInput(initialRecord.tags?.join(', ') || '');
      setIsPinned(Boolean(initialRecord.is_pinned));
    } else {
      setTitle('');
      setCategory('Credentials');
      setContent('');
      setTagsInput('');
      setIsPinned(false);
    }
    setError(null);
  }, [initialRecord, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Please provide a descriptive title for this record.');
      return;
    }
    if (cleanTitle.length > 255) {
      setError('Title cannot exceed 255 characters.');
      return;
    }
    if (!content.trim()) {
      setError('Record content cannot be empty.');
      return;
    }

    const tags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    setIsSubmitting(true);
    try {
      await onSave({
        title: cleanTitle,
        category,
        content,
        is_pinned: isPinned,
        tags,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        id="record-editor-modal"
        className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neutral-800 border border-neutral-700/60 flex items-center justify-center text-neutral-300">
              <Lock className="w-4 h-4 text-neutral-200" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-100">
                {initialRecord ? 'Edit Private Record' : 'Create Private Record'}
              </h2>
              <p className="text-xs text-neutral-400">
                {initialRecord
                  ? 'Update existing entry in your secure database'
                  : 'Encrypted storage with row-level ownership isolation'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800/60 text-xs text-rose-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Title & Category Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-neutral-400 mb-1.5 uppercase font-mono tracking-wider">
                Record Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Primary AWS Root Credentials, Offshore Account IBAN"
                className="w-full px-3.5 py-2 bg-neutral-950/80 border border-neutral-800 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-400 transition-colors"
                maxLength={255}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5 uppercase font-mono tracking-wider">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as RecordCategory)}
                className="w-full px-3 py-2 bg-neutral-950/80 border border-neutral-800 rounded-lg text-sm text-neutral-200 focus:outline-none focus:ring-1 focus:ring-neutral-400 transition-colors cursor-pointer"
              >
                {RECORD_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Content Area */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-neutral-400 uppercase font-mono tracking-wider">
                Confidential Content *
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsMonospace(!isMonospace)}
                  className={`text-[11px] font-mono px-2 py-0.5 rounded border transition-colors flex items-center gap-1 cursor-pointer ${
                    isMonospace
                      ? 'bg-neutral-800 border-neutral-700 text-neutral-200'
                      : 'border-neutral-800 text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  <Code className="w-3 h-3" />
                  Monospace
                </button>
                <span className="text-neutral-500 text-[11px] font-mono">
                  {content.length} chars
                </span>
              </div>
            </div>
            <textarea
              required
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste or write confidential keys, passwords, recovery phrases, or private notes..."
              className={`w-full p-3.5 bg-neutral-950/80 border border-neutral-800 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-400 transition-colors leading-relaxed ${
                isMonospace ? 'font-mono text-xs' : 'font-sans'
              }`}
            />
          </div>

          {/* Tags & Pin Toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-neutral-400 mb-1.5 uppercase font-mono tracking-wider">
                Tags (Comma separated)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="production, backup, critical, 2026"
                className="w-full px-3.5 py-2 bg-neutral-950/80 border border-neutral-800 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-400 font-mono text-xs transition-colors"
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2.5 p-2 bg-neutral-950/60 border border-neutral-800 rounded-lg cursor-pointer w-full hover:bg-neutral-950 transition-colors">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="rounded bg-neutral-900 border-neutral-700 text-neutral-100 focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs text-neutral-300 flex items-center gap-1.5 select-none font-medium">
                  <Pin className="w-3.5 h-3.5 text-amber-400" /> Pin to Top
                </span>
              </label>
            </div>
          </div>

          {/* Footer Controls */}
          <div className="pt-4 border-t border-neutral-800 flex items-center justify-between">
            <span className="text-[11px] text-neutral-500 font-mono">
              Protected by Supabase RLS
            </span>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium rounded-lg text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-neutral-100 hover:bg-white text-neutral-950 font-medium rounded-lg text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin"></span>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>{initialRecord ? 'Update Record' : 'Save Record'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
