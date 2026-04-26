'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  image?: string;
}

interface ShippingAddress {
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  subtotal: number;
  shippingCost: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  shippingAddress: ShippingAddress;
  paymentMethod: string;
  shippingMethod: string;
}

// Timeline steps for order status
const STATUS_STEPS = ['pending', 'processing', 'shipped', 'delivered'];

function getStatusIndex(status: string): number {
  const idx = STATUS_STEPS.indexOf(status.toLowerCase());
  return idx >= 0 ? idx : 0;
}

function statusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'processing':
      return 'bg-blue-100 text-blue-800';
    case 'shipped':
      return 'bg-purple-100 text-purple-800';
    case 'delivered':
      return 'bg-green-100 text-green-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-slate-100 text-slate-800';
  }
}

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('auth_access_token');
    if (!token || !orderId) return;

    api<OrderDetail>(`/orders/${orderId}`, { token })
      .then((data) => setOrder(data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load order'))
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/3" />
          <div className="h-4 bg-slate-200 rounded w-full" />
          <div className="h-4 bg-slate-200 rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error || 'Order not found'}
        </div>
        <Link
          href="/account/orders"
          className="inline-block mt-4 text-sm text-slate-600 hover:text-slate-800 transition"
        >
          &larr; Back to Orders
        </Link>
      </div>
    );
  }

  const currentStatusIdx = getStatusIndex(order.status);
  const isCancelled = order.status.toLowerCase() === 'cancelled';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <Link
            href="/account/orders"
            className="text-sm text-slate-500 hover:text-slate-800 transition"
          >
            &larr; Back to Orders
          </Link>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium capitalize ${statusColor(order.status)}`}
          >
            {order.status}
          </span>
        </div>

        <h1 className="text-xl font-semibold text-slate-800 mb-1">
          Order #{order.orderNumber || order.id.slice(0, 8)}
        </h1>
        <p className="text-sm text-slate-500">
          Placed on{' '}
          {new Date(order.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* Status timeline */}
      {!isCancelled && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Order Status</h2>
          <div className="flex items-center justify-between">
            {STATUS_STEPS.map((step, idx) => (
              <div key={step} className="flex-1 flex flex-col items-center relative">
                {/* Connector line */}
                {idx > 0 && (
                  <div
                    className={`absolute top-3 right-1/2 w-full h-0.5 -z-0 ${
                      idx <= currentStatusIdx ? 'bg-slate-800' : 'bg-slate-200'
                    }`}
                  />
                )}
                {/* Circle */}
                <div
                  className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    idx <= currentStatusIdx
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-200 text-slate-400'
                  }`}
                >
                  {idx < currentStatusIdx ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    idx + 1
                  )}
                </div>
                <span className="mt-2 text-xs text-slate-500 capitalize">{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Items */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">Items</h2>
        <div className="divide-y divide-slate-200">
          {order.items?.map((item) => (
            <div key={item.id} className="flex items-center gap-4 py-3">
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-14 h-14 rounded-lg object-cover border border-slate-200"
                />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 text-xs">
                  No img
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                <p className="text-xs text-slate-500">Qty: {item.quantity}</p>
              </div>
              <p className="text-sm font-medium text-slate-800">
                ${(item.price * item.quantity).toFixed(2)}
              </p>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="border-t border-slate-200 mt-3 pt-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Subtotal</span>
            <span className="text-slate-800">${order.subtotal?.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Shipping</span>
            <span className="text-slate-800">${order.shippingCost?.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold border-t border-slate-200 pt-2">
            <span className="text-slate-800">Total</span>
            <span className="text-slate-800">${order.total?.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Shipping info */}
      {order.shippingAddress && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Shipping Address</h2>
          <div className="text-sm text-slate-600 space-y-0.5">
            <p className="font-medium text-slate-800">
              {order.shippingAddress.firstName} {order.shippingAddress.lastName}
            </p>
            <p>{order.shippingAddress.address}</p>
            <p>
              {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
              {order.shippingAddress.postalCode}
            </p>
            <p>{order.shippingAddress.country}</p>
            {order.shippingAddress.phone && <p>{order.shippingAddress.phone}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
