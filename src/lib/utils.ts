import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0
  }).format(amount)
}

export function formatDate(date: any) {
  if (!date) return 'N/A';
  try {
    const d = date?.toDate ? date.toDate() : new Date(date);
    if (isNaN(d.getTime())) return 'Invalid Date';
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
    }).format(d);
  } catch (e) {
    return 'Invalid Date';
  }
}

export function formatTime(date: any) {
  if (!date) return 'N/A';
  try {
    const d = date?.toDate ? date.toDate() : new Date(date);
    if (isNaN(d.getTime())) return 'Invalid Time';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return 'Invalid Time';
  }
}

export function toJSDate(date: any): Date | null {
  if (!date) return null;
  try {
    const d = date?.toDate ? date.toDate() : new Date(date);
    return isNaN(d.getTime()) ? null : d;
  } catch (e) {
    return null;
  }
}
