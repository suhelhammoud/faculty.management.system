import * as React from 'react';
import { cn } from '@/modules/hr/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'hr:flex hr:field-sizing-content hr:min-h-16 hr:w-full hr:rounded-md hr:border hr:border-input hr:bg-transparent hr:px-3 hr:py-2 hr:text-base hr:shadow-xs hr:transition-[color,box-shadow] hr:outline-none hr:placeholder:text-muted-foreground hr:focus-visible:border-ring hr:focus-visible:ring-[3px] hr:focus-visible:ring-ring/50 hr:disabled:cursor-not-allowed hr:disabled:opacity-50 hr:aria-invalid:border-destructive hr:aria-invalid:ring-destructive/20 hr:md:text-sm ',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
