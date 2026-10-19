'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Upload, Loader2, X } from 'lucide-react';
import { compileAllowedChars } from '@multi-stores/core/personalization/rules';
import { filterAllowedChars, type FormField } from '@/lib/personalization/form';
import { absoluteUploadUrl, uploadCustomerFile, UPLOAD_RATE_LIMITED } from '@/lib/customerUpload';

/** Display label for a raw option value; falls back to the value itself. */
function optionDisplayLabel(field: Pick<CustomField, 'optionLabels'>, value: string): string {
  return field.optionLabels?.[value] ?? value;
}

/** Form model of one field (built by `usePersonalizationFields`). */
export type CustomField = FormField;

interface CustomFieldsFormProps {
  fields: CustomField[];
  values: Record<string, unknown>;
  onChange: (fieldId: string, value: unknown) => void;
  /** Localized message per field id (shared validator + API field errors). */
  errors?: Record<string, string | undefined>;
  /** Show errors of empty fields too (after a submit attempt). */
  showAllErrors?: boolean;
  /** Fields that can be fixed with "Fill with <char>" now: field id → fill char. */
  fillable?: Record<string, string>;
  onFill?: (fieldId: string) => void;
}

const COMMON_FONTS = [
  'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana',
  'Courier New', 'Impact', 'Comic Sans MS', 'Trebuchet MS', 'Palatino',
  'Garamond', 'Bookman', 'Avant Garde',
];

/** File types the customer-upload endpoint accepts (M4.0 §8.2). */
const CUSTOMER_FILE_ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf,.ai';
/** IMAGE / MULTI_IMAGE: the raster types the endpoint accepts (no gif, heic, svg…). */
const CUSTOMER_IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp';

function resolveDisplayUrl(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') {
    if (val.startsWith('http') || val.startsWith('/uploads')) return absoluteUploadUrl(val);
    return val;
  }
  return '';
}

function FileInput({ accept, images = false, multiple, value, onChange }: {
  accept?: string;
  /** Previews render as images (IMAGE / MULTI_IMAGE). */
  images?: boolean;
  multiple?: boolean; value: unknown;
  onChange: (val: unknown) => void;
}) {
  const t = useTranslations('product');
  const te = useTranslations('errors');
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  // Original file names of this session's uploads (the value is the preview URL).
  const [names, setNames] = useState<Record<string, string>>({});

  // Derive display from value
  const urls: string[] = Array.isArray(value)
    ? value.map(resolveDisplayUrl).filter(Boolean)
    : value ? [resolveDisplayUrl(value)].filter(Boolean) : [];
  const isImage = images;

  const handleFiles = async (files: FileList) => {
    setUploading(true);
    setUploadError('');
    const fail = (code: string) =>
      setUploadError(code === UPLOAD_RATE_LIMITED ? t('uploadTooManyRequests') : te.has(code) ? te(code) : te('generic'));
    try {
      if (multiple) {
        const uploaded: string[] = [...(Array.isArray(value) ? value : [])];
        for (const file of Array.from(files)) {
          const res = await uploadCustomerFile(file);
          if ('url' in res) {
            uploaded.push(res.url);
            setNames((prev) => ({ ...prev, [res.url]: res.name }));
          } else fail(res.error);
        }
        onChange(uploaded);
      } else {
        const res = await uploadCustomerFile(files[0]!);
        if ('url' in res) {
          setNames((prev) => ({ ...prev, [res.url]: res.name }));
          onChange(res.url);
        } else fail(res.error);
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
                  {/* Customer uploads always have a WebP preview (a placeholder for PDF/AI). */}
                  {url.includes('/uploads/customer-previews/') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="" className="w-6 h-6 rounded object-cover" />
                  ) : (
                    <Upload className="w-3 h-3" />
                  )}
                  {(names[url] ?? url.split('/').pop() ?? '').slice(0, 24)}
                </div>
              )}
              <button type="button" onClick={() => {
                if (multiple && Array.isArray(value)) {
                  onChange(value.filter((_: unknown, j: number) => j !== i));
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
          ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('uploading')}</>
          : <><Upload className="w-4 h-4 text-gray-400" /> {multiple ? t('chooseFiles') : t('chooseFile')}</>
        }
      </button>
      {uploadError && <p role="alert" className="text-xs text-red-600 font-medium">{uploadError}</p>}
    </div>
  );
}

export function CustomFieldsForm({
  fields, values, onChange, errors = {}, showAllErrors = false, fillable = {}, onFill,
}: CustomFieldsFormProps) {
  const t = useTranslations();
  // `allowed_chars` per field, compiled once (null = no rule / invalid body).
  const allowed = useMemo(() => {
    const out: Record<string, RegExp | null> = {};
    for (const f of fields) out[f.id] = f.allowedChars ? compileAllowedChars(f.allowedChars) : null;
    return out;
  }, [fields]);
  // Field whose input just dropped characters (brief notice).
  const [filteredField, setFilteredField] = useState<string | null>(null);
  useEffect(() => {
    if (!filteredField) return;
    const timer = setTimeout(() => setFilteredField(null), 2500);
    return () => clearTimeout(timer);
  }, [filteredField]);

  // TEXT / TEXTAREA: characters the field's allowed set rejects are dropped
  // while typing; during IME composition the raw text is kept and filtered
  // once the composition ends (`onCompositionEnd`).
  const onTextChange = (field: CustomField, raw: string, composing: boolean) => {
    const re = allowed[field.id];
    if (!re || composing) return onChange(field.id, raw);
    const kept = filterAllowedChars(raw, re);
    if (kept !== raw.normalize('NFC')) setFilteredField(field.id);
    onChange(field.id, kept);
  };

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
        // Values are stored as `unknown`; each control below only ever receives
        // the primitive its own field type wrote, so this narrowing is type-only.
        const value = values[field.id] as string | number | undefined;
        const hasValue = value !== undefined && value !== null && value !== '';
        const showError = !!error && (hasValue || showAllErrors);
        const fillChar = fillable[field.id];

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
                aria-invalid={showError || undefined}
                onChange={(e) => onTextChange(field, e.target.value, (e.nativeEvent as InputEvent).isComposing === true)}
                onCompositionEnd={(e) => onTextChange(field, e.currentTarget.value, false)}
                className={inputClass(showError)} />
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
                  <option value="">{field.placeholder || t('product.chooseOption')}</option>
                  {field.options?.map((opt) => (
                    <option key={opt} value={opt}>{optionDisplayLabel(field, opt)}</option>
                  ))}
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
                aria-invalid={showError || undefined}
                onChange={(e) => onTextChange(field, e.target.value, (e.nativeEvent as InputEvent).isComposing === true)}
                onCompositionEnd={(e) => onTextChange(field, e.currentTarget.value, false)}
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
                  <option value="">{field.placeholder || t('product.selectFont')}</option>
                  {(field.options?.length ? field.options : COMMON_FONTS).map((font) => (
                    <option key={font} value={font} style={{ fontFamily: font }}>{optionDisplayLabel(field, font)}</option>
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
              <FileInput accept={CUSTOMER_IMAGE_ACCEPT} images value={value} onChange={(v) => onChange(field.id, v)} />
            )}

            {/* FILE */}
            {field.type === 'FILE' && (
              <FileInput accept={CUSTOMER_FILE_ACCEPT} value={value} onChange={(v) => onChange(field.id, v)} />
            )}

            {/* MULTI_IMAGE */}
            {field.type === 'MULTI_IMAGE' && (
              <FileInput accept={CUSTOMER_IMAGE_ACCEPT} images multiple value={value} onChange={(v) => onChange(field.id, v)} />
            )}

            {/* Characters outside the allowed set were dropped */}
            {filteredField === field.id && (
              <p className="mt-1.5 text-xs text-amber-600">{t('product.invalidCharacters')}</p>
            )}

            {/* Validation error */}
            {showError && <p className="mt-1.5 text-xs text-red-600 font-medium">{error}</p>}

            {/* equal_length with a fill char: pad the shorter text */}
            {fillChar && onFill && (
              <button type="button" onClick={() => onFill(field.id)}
                className="mt-1.5 inline-flex items-center rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                {t('product.fillWith', { char: fillChar })}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
