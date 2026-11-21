import * as React from 'react';
import { cn } from '@/modules/inventory/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'inv:flex inv:field-sizing-content inv:min-h-16 inv:w-full inv:rounded-md inv:border inv:border-input inv:bg-transparent inv:px-3 inv:py-2 inv:text-base inv:shadow-xs inv:transition-[color,box-shadow] inv:outline-none inv:placeholder:text-muted-foreground inv:focus-visible:border-ring inv:focus-visible:ring-[3px] inv:focus-visible:ring-ring/50 inv:disabled:cursor-not-allowed inv:disabled:opacity-50 inv:aria-invalid:border-destructive inv:aria-invalid:ring-destructive/20 inv:md:text-sm ',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
