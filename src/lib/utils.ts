import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function getRoundedClass(style?: 'Rounded' | 'Square' | 'Pill') {
    switch (style) {
        case 'Pill': return 'rounded-full';
        case 'Rounded': return 'rounded-2xl';
        case 'Square': return 'rounded-none';
        default: return 'rounded-full';
    }
}
