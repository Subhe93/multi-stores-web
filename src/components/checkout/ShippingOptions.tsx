'use client';

interface ShippingOption {
  id: string;
  name: string;
  price: number;
  estimated_days: { min: number; max: number };
  currency?: string;
}

interface ShippingOptionsProps {
  options: ShippingOption[];
  selectedId?: string;
  onSelect: (id: string) => void;
  currency?: string;
}

export function ShippingOptions({ options, selectedId, onSelect, currency: fallbackCurrency = 'EUR' }: ShippingOptionsProps) {
  // Fallback when no options are available
  if (!options || options.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full border-2 border-blue-600 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-blue-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-800">Standard Shipping</p>
            <p className="text-xs text-slate-500">Estimated delivery time varies</p>
          </div>
          <p className="text-sm font-medium text-slate-800">Free</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {options.map((option) => {
        const isSelected = option.id === selectedId;
        const formatter = new Intl.NumberFormat('en', {
          style: 'currency',
          currency: option.currency || fallbackCurrency,
        });

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            className={`w-full rounded-lg border-2 p-4 text-left transition-colors ${
              isSelected
                ? 'border-blue-600 bg-blue-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-3">
              {/* Radio indicator */}
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  isSelected ? 'border-blue-600' : 'border-slate-400'
                }`}
              >
                {isSelected && (
                  <div className="w-2 h-2 rounded-full bg-blue-600" />
                )}
              </div>

              {/* Option details */}
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800">{option.name}</p>
                <p className="text-xs text-slate-500">
                  {option.estimated_days.min}-{option.estimated_days.max} business days
                </p>
              </div>

              {/* Price */}
              <p className="text-sm font-medium text-slate-800">
                {option.price === 0 ? 'Free' : formatter.format(option.price)}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
