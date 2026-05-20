'use client';

import { useMemo, useRef, useState } from 'react';
import { Upload, Loader2, X } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const API_ORIGIN = API_URL.replace(/\/api$/, '');

export interface CustomField {
  id: string;
  type: 'TEXT' | 'NUMBER' | 'SELECT' | 'COLOR' | 'TEXTAREA' | 'BOOLEAN' | 'DATE' | 'IMAGE' | 'FILE' | 'FONT' | 'MULTI_IMAGE';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    linked_to?: string;
    rule?: string;
  };
}

interface CustomFieldsFormProps {
  fields: CustomField[];
  values: Record<string, any>;
  onChange: (fieldId: string, value: any) => void;
}

const COMMON_FONTS = [
  'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana',
  'Courier New', 'Impact', 'Comic Sans MS', 'Trebuchet MS', 'Palatino',
  'Garamond', 'Bookman', 'Avant Garde',
];

function validateField(
  field: CustomField,
  value: any,
  allValues: Record<string, any>,
  allFields: CustomField[],
): string | null {
  const strValue = value != null ? String(value) : '';

  if (field.required && (value === undefined || value === null || strValue === '')) {
    return `${field.label} is required`;
  }

  if (!strValue && !field.required) return null;

  const v = field.validation;
  if (!v) return null;

  if (field.type === 'NUMBER') {
    const num = Number(value);
    if (v.min !== undefined && num < v.min) return `Minimum value is ${v.min}`;
    if (v.max !== undefined && num > v.max) return `Maximum value is ${v.max}`;
  }

  if (field.type === 'TEXT' || field.type === 'TEXTAREA') {
    if (v.min !== undefined && strValue.length < v.min) return `Minimum length is ${v.min} characters`;
    if (v.max !== undefined && strValue.length > v.max) return `Maximum length is ${v.max} characters`;
  }

  if (v.pattern && strValue) {
    try {
      if (!new RegExp(v.pattern).test(strValue)) return 'Invalid format';
    } catch { /* skip invalid regex */ }
  }

  if (v.linked_to && v.rule) {
    const linkedField = allFields.find((f) => f.id === v.linked_to);
    const linkedValue = allValues[v.linked_to];
    if (linkedField && linkedValue != null && v.rule === 'equal_length') {
      if (strValue.length !== String(linkedValue).length) {
        return `Length must match ${linkedField.label} (${String(linkedValue).length} characters)`;
      }
    }
  }

  return null;
}

async function uploadFile(file: File, folder = 'custom-fields'): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_URL}/uploads/public?folder=${folder}`, {
      method: 'POST',
      body: formData,
    });
    const json = await res.json();
    if (json.data?.url) {
      const url = json.data.url;
      return url.startsWith('http') ? url : `${API_ORIGIN}${url}`;
    }
    return null;
  } catch {
    return null;
  }
}

function resolveDisplayUrl(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') {
    if (val.startsWith('http') || val.startsWith('/uploads')) return val.startsWith('http') ? val : `${API_ORIGIN}${val}`;
    return val;
  }
  return '';
}

function FileInput({ accept, multiple, value, onChange }: {
  accept?: string; multiple?: boolean; value: any;
  onChange: (val: any) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Derive display from value
  const urls: string[] = Array.isArray(value)
    ? value.map(resolveDisplayUrl).filter(Boolean)
    : value ? [resolveDisplayUrl(value)].filter(Boolean) : [];
  const isImage = accept?.includes('image');

  const handleFiles = async (files: FileList) => {
    setUploading(true);
    try {
      if (multiple) {
        const uploaded: string[] = [...(Array.isArray(value) ? value : [])];
        for (const file of Array.from(files)) {
          const url = await uploadFile(file);
          if (url) uploaded.push(url);
        }
        onChange(uploaded);
      } else {
        const url = await uploadFile(files[0]!);
        if (url) onChange(url);
      }
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <input ref={ref} type="file" accept={accept} multiple={multiple} className="hidden"
        onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); }}
      />

      {/* Previews */}
      {urls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {urls.map((url, i) => (
            <div key={i} className="relative group">
              {isImage ? (
                <img src={url} alt="" className="w-16 h-16 rounded-lg object-cover border border-gray-200" />
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-600">
                  <Upload className="w-3 h-3" />
                  {url.split('/').pop()?.slice(0, 20)}
                </div>
              )}
              <button type="button" onClick={() => {
                if (multiple && Array.isArray(value)) {
                  onChange(value.filter((_: any, j: number) => j !== i));
                } else {
                  onChange('');
                }
              }} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button type="button" onClick={() => ref.current?.click()} disabled={uploading}
        className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 px-4 py-4 text-sm text-gray-500 hover:border-gray-300 hover:bg-gray-50 transition-all disabled:opacity-50"
      >
        {uploading
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
          : <><Upload className="w-4 h-4 text-gray-400" /> {multiple ? 'Choose files...' : 'Choose file...'}</>
        }
      </button>
    </div>
  );
}

export function CustomFieldsForm({ fields, values, onChange }: CustomFieldsFormProps) {
  const errors = useMemo(() => {
    const result: Record<string, string | null> = {};
    for (const field of fields) {
      result[field.id] = validateField(field, values[field.id], values, fields);
    }
    return result;
  }, [fields, values]);

  const inputClass = (hasError: boolean) =>
    `w-full rounded-xl border px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 ${
      hasError
        ? 'border-red-300 focus:ring-red-500'
        : 'border-gray-200 focus:ring-gray-900/20 focus:border-gray-400'
    }`;

  return (
    <div className="flex flex-col gap-5">
      {fields.map((field) => {
        const error = errors[field.id];
        const value = values[field.id];
        const hasValue = value !== undefined && value !== null && value !== '';
        const showError = !!error && hasValue;

        return (
          <div key={field.id}>
            {/* Label */}
            {field.type !== 'BOOLEAN' && (
              <p className="text-sm font-semibold text-gray-900 mb-2">
                {field.label}
                {field.required && <span className="text-red-500 ml-0.5">*</span>}
              </p>
            )}

            {/* TEXT */}
            {field.type === 'TEXT' && (
              <input id={`field-${field.id}`} type="text" value={value ?? ''} placeholder={field.placeholder}
                onChange={(e) => onChange(field.id, e.target.value)} className={inputClass(showError)} />
            )}

            {/* NUMBER */}
            {field.type === 'NUMBER' && (
              <input id={`field-${field.id}`} type="number" value={value ?? ''} placeholder={field.placeholder}
                min={field.validation?.min} max={field.validation?.max}
                onChange={(e) => onChange(field.id, e.target.value === '' ? '' : Number(e.target.value))}
                className={inputClass(showError)} />
            )}

            {/* SELECT */}
            {field.type === 'SELECT' && (
              <div className="relative">
                <select id={`field-${field.id}`} value={value ?? ''}
                  onChange={(e) => onChange(field.id, e.target.value)}
                  className={`${inputClass(showError)} appearance-none pr-10`}>
                  <option value="">{field.placeholder || `Choose an option`}</option>
                  {field.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            )}

            {/* COLOR */}
            {field.type === 'COLOR' && (
              <div className="flex items-center gap-3">
                <input id={`field-${field.id}`} type="color" value={value || '#000000'}
                  onChange={(e) => onChange(field.id, e.target.value)}
                  className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
                <span className="text-sm text-gray-500 uppercase font-mono">{value || '#000000'}</span>
              </div>
            )}

            {/* TEXTAREA */}
            {field.type === 'TEXTAREA' && (
              <textarea id={`field-${field.id}`} value={value ?? ''} placeholder={field.placeholder} rows={4}
                onChange={(e) => onChange(field.id, e.target.value)}
                className={`${inputClass(showError)} resize-y`} />
            )}

            {/* BOOLEAN */}
            {field.type === 'BOOLEAN' && (
              <label htmlFor={`field-${field.id}`} className="flex items-center gap-2.5 cursor-pointer group">
                <input id={`field-${field.id}`} type="checkbox" checked={!!value}
                  onChange={(e) => onChange(field.id, e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 transition-colors"
                  style={{ accentColor: 'var(--store-primary, #2563eb)' }} />
                <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                  {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
                </span>
              </label>
            )}

            {/* DATE */}
            {field.type === 'DATE' && (
              <input id={`field-${field.id}`} type="date" value={value ?? ''}
                onChange={(e) => onChange(field.id, e.target.value)} className={inputClass(showError)} />
            )}

            {/* FONT */}
            {field.type === 'FONT' && (
              <div className="relative">
                <select id={`field-${field.id}`} value={value ?? ''}
                  onChange={(e) => onChange(field.id, e.target.value)}
                  className={`${inputClass(showError)} appearance-none pr-10`}>
                  <option value="">{field.placeholder || 'Select font...'}</option>
                  {(field.options?.length ? field.options : COMMON_FONTS).map((font) => (
                    <option key={font} value={font} style={{ fontFamily: font }}>{font}</option>
                  ))}
                </select>
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            )}

            {/* IMAGE */}
            {field.type === 'IMAGE' && (
              <FileInput accept="image/*" value={value} onChange={(v) => onChange(field.id, v)} />
            )}

            {/* FILE */}
            {field.type === 'FILE' && (
              <FileInput accept="*" value={value} onChange={(v) => onChange(field.id, v)} />
            )}

            {/* MULTI_IMAGE */}
            {field.type === 'MULTI_IMAGE' && (
              <FileInput accept="image/*" multiple value={value} onChange={(v) => onChange(field.id, v)} />
            )}

            {/* Validation error */}
            {showError && <p className="mt-1.5 text-xs text-red-600 font-medium">{error}</p>}
          </div>
        );
      })}
    </div>
  );
}
