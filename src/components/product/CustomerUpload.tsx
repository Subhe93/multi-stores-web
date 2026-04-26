'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';

interface CustomerUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSizeMB?: number;
  previewUrl?: string;
  label?: string;
  required?: boolean;
}

export function CustomerUpload({
  onFileSelect,
  accept = 'image/*',
  maxSizeMB = 10,
  previewUrl: initialPreviewUrl,
  label,
  required,
}: CustomerUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(initialPreviewUrl ?? null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const validateAndSetFile = useCallback(
    (file: File) => {
      setError(null);

      if (accept !== '*') {
        const acceptedTypes = accept.split(',').map((t) => t.trim());
        const isValid = acceptedTypes.some((type) => {
          if (type.endsWith('/*')) return file.type.startsWith(type.replace('/*', ''));
          if (type.startsWith('.')) return file.name.toLowerCase().endsWith(type.toLowerCase());
          return file.type === type;
        });
        if (!isValid) {
          setError(`Invalid file type. Accepted: ${accept}`);
          return;
        }
      }

      if (file.size > maxSizeBytes) {
        setError(`File too large. Maximum size: ${maxSizeMB}MB`);
        return;
      }

      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target?.result as string);
        reader.readAsDataURL(file);
      } else {
        setPreview(null);
      }

      setFileName(file.name);
      onFileSelect(file);
    },
    [accept, maxSizeBytes, maxSizeMB, onFileSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) validateAndSetFile(file);
    },
    [validateAndSetFile],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndSetFile(file);
    },
    [validateAndSetFile],
  );

  const handleRemove = useCallback(() => {
    setPreview(null);
    setFileName(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  return (
    <div>
      {/* Label */}
      {label && (
        <p className="text-sm font-semibold text-gray-900 mb-3">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </p>
      )}

      {/* Preview state */}
      {(preview || fileName) ? (
        <div className="relative rounded-xl border border-gray-200 overflow-hidden bg-white">
          {preview ? (
            <div className="aspect-video bg-gray-50 p-2">
              <img
                src={preview}
                alt="Upload preview"
                className="w-full h-full object-contain rounded-lg"
              />
            </div>
          ) : (
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <span className="text-sm text-gray-700 truncate flex-1">{fileName}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 p-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Change
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="px-3 py-2 text-sm font-medium text-gray-400 bg-white border border-gray-200 rounded-lg hover:text-red-500 hover:border-red-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <input ref={inputRef} type="file" accept={accept} onChange={handleInputChange} className="hidden" />
        </div>
      ) : (
        /* Drag & drop zone */
        <div>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`rounded-xl border-2 border-dashed px-6 py-6 transition-all ${
              isDragging
                ? 'border-gray-400 bg-gray-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-center gap-4">
              <Upload className="w-6 h-6 text-gray-300 shrink-0" />

              <p className="text-sm text-gray-500">
                Drag & Drop Files Here
              </p>

              <span className="text-sm text-gray-300">or</span>

              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors hover:opacity-90"
                style={{ backgroundColor: 'var(--store-primary, #111827)' }}
              >
                Browse Files
              </button>
            </div>
          </div>

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          <input ref={inputRef} type="file" accept={accept} onChange={handleInputChange} className="hidden" />
        </div>
      )}
    </div>
  );
}
