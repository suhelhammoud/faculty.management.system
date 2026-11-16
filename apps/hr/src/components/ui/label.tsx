import * as React from 'react';
import { cn } from '@/lib/utils';
import { Label as LabelPrimitive } from 'radix-ui';

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        'hr:flex hr:items-center hr:gap-2 hr:text-sm hr:leading-none hr:font-medium hr:select-none hr:group-data-[disabled=true]:pointer-events-none hr:group-data-[disabled=true]:opacity-50 hr:peer-disabled:cursor-not-allowed hr:peer-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Label };
