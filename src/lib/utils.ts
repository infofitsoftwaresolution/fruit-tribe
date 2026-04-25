import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/** Full INR for product UI (grouped digits), e.g. ₹1,80,000 — not raw 180000. */
export function formatInr(amount: number): string {
    const n = Number(amount);
    if (!Number.isFinite(n)) return '₹0';
    return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: n % 1 === 0 ? 0 : 2 })}`;
}

/** Compact INR for dashboards: avoids ₹0.0K when revenue is under ₹1,000. */
export function formatInrCompact(amount: number): string {
    const n = Math.max(0, Number(amount) || 0);
    if (n < 1000) {
        return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: n % 1 === 0 ? 0 : 2 })}`;
    }
    if (n < 100000) {
        return `₹${(n / 1000).toFixed(n < 10000 ? 1 : 0)}K`;
    }
    return `₹${(n / 100000).toFixed(2)}L`;
}

export function getRoundedClass(style?: 'Rounded' | 'Square' | 'Pill') {
    switch (style) {
        case 'Pill': return 'rounded-full';
        case 'Rounded': return 'rounded-2xl';
        case 'Square': return 'rounded-none';
        default: return 'rounded-full';
    }
}

/** Native `<button>` / form CTAs: instant tap scale + no mobile tap delay (use with `cn()`). */
export const pressableSurfaceClass =
    'touch-manipulation select-none transition-[transform,opacity] duration-100 ease-out active:scale-[0.98] disabled:active:scale-100';

/** Framer Motion: fast press feedback (avoids sluggish default spring on taps). */
export const motionTapTransition = {
    type: 'tween' as const,
    duration: 0.1,
    ease: 'easeOut' as const,
};

/** Runtime reduced-motion preference check for animation guards. */
export function prefersReducedMotion(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
