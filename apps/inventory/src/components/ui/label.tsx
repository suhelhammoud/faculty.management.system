import * as React from 'react';
import { cn } from '@/lib/utils';
import { Label as LabelPrimitive } from 'radix-ui';

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        'inv:flex inv:items-center inv:gap-2 inv:text-sm inv:leading-none inv:font-medium inv:select-none inv:group-data-[disabled=true]:pointer-events-none inv:group-data-[disabled=true]:opacity-50 inv:peer-disabled:cursor-not-allowed inv:peer-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Label };
