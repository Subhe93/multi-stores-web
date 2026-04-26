'use client';

interface QuantitySelectorProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
}

export function QuantitySelector({ value, onChange, min = 1, max }: QuantitySelectorProps) {
  const canDecrement = value > min;
  const canIncrement = max === undefined || value < max;

  return (
    <div className="inline-flex items-center rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => canDecrement && onChange(value - 1)}
        disabled={!canDecrement}
        aria-label="Decrease quantity"
        className="w-10 h-10 flex items-center justify-center text-lg font-bold text-gray-600 hover:bg-gray-50 transition-colors disabled:text-gray-200 disabled:cursor-not-allowed"
      >
        &minus;
      </button>

      <span className="min-w-10 h-10 flex items-center justify-center text-sm font-bold text-gray-900 select-none border-x border-gray-200">
        {value}
      </span>

      <button
        type="button"
        onClick={() => canIncrement && onChange(value + 1)}
        disabled={!canIncrement}
        aria-label="Increase quantity"
        className="w-10 h-10 flex items-center justify-center text-lg font-bold text-gray-600 hover:bg-gray-50 transition-colors disabled:text-gray-200 disabled:cursor-not-allowed"
      >
        +
      </button>
    </div>
  );
}
