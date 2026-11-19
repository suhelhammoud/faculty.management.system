import * as React from 'react';
import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'inv:h-9 inv:w-full inv:min-w-0 inv:rounded-md inv:border inv:border-input inv:bg-transparent inv:px-3 inv:py-1 inv:text-base inv:shadow-xs inv:transition-[color,box-shadow] inv:outline-none inv:selection:bg-primary inv:selection:text-primary-foreground inv:file:inline-flex inv:file:h-7 inv:file:border-0 inv:file:bg-transparent inv:file:text-sm inv:file:font-medium inv:file:text-foreground inv:placeholder:text-muted-foreground inv:disabled:pointer-events-none inv:disabled:cursor-not-allowed inv:disabled:opacity-50 inv:md:text-sm ',
        'inv:focus-visible:border-ring inv:focus-visible:ring-[3px] inv:focus-visible:ring-ring/50',
        'inv:aria-invalid:border-destructive inv:aria-invalid:ring-destructive/20 ',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
