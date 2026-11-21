import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
const twMerge = extendTailwindMerge({ prefix: 'hr' });
export const cn = (...values: ClassValue[]) => twMerge(clsx(values));
