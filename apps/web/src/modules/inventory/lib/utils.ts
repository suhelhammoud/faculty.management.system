import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
const twMerge = extendTailwindMerge({ prefix: 'inv' });
export const cn = (...values: ClassValue[]) => twMerge(clsx(values));
