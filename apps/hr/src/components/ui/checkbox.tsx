import * as React from 'react';
import { cn } from '@/lib/utils';
import { CheckIcon } from 'lucide-react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';

function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'hr:peer hr:size-4 hr:shrink-0 hr:rounded-[4px] hr:border hr:border-input hr:shadow-xs hr:transition-shadow hr:outline-none hr:focus-visible:border-ring hr:focus-visible:ring-[3px] hr:focus-visible:ring-ring/50 hr:disabled:cursor-not-allowed hr:disabled:opacity-50 hr:aria-invalid:border-destructive hr:aria-invalid:ring-destructive/20 hr:data-[state=checked]:border-primary hr:data-[state=checked]:bg-primary hr:data-[state=checked]:text-primary-foreground ',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="hr:grid hr:place-content-center hr:text-current hr:transition-none"
      >
        <CheckIcon className="hr:size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
