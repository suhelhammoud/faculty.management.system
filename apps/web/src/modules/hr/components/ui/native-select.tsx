import * as React from 'react';
import { cn } from '@/modules/hr/lib/utils';
import { ChevronDownIcon } from 'lucide-react';

function NativeSelect({
  className,
  size = 'default',
  ...props
}: Omit<React.ComponentProps<'select'>, 'size'> & { size?: 'sm' | 'default' }) {
  return (
    <div
      className="hr:group/native-select hr:relative hr:w-fit hr:has-[select:disabled]:opacity-50"
      data-slot="native-select-wrapper"
    >
      <select
        data-slot="native-select"
        data-size={size}
        className={cn('hr:appearance-none', className)}
        {...props}
      />
      <ChevronDownIcon
        className="hr:pointer-events-none hr:absolute hr:top-1/2 hr:end-3.5 hr:size-4 hr:-translate-y-1/2 hr:text-muted-foreground hr:opacity-50 hr:select-none"
        aria-hidden="true"
        data-slot="native-select-icon"
      />
    </div>
  );
}

function NativeSelectOption({ className, ...props }: React.ComponentProps<'option'>) {
  return (
    <option
      data-slot="native-select-option"
      className={cn('hr:bg-[Canvas] hr:text-[CanvasText]', className)}
      {...props}
    />
  );
}

function NativeSelectOptGroup({ className, ...props }: React.ComponentProps<'optgroup'>) {
  return (
    <optgroup
      data-slot="native-select-optgroup"
      className={cn('hr:bg-[Canvas] hr:text-[CanvasText]', className)}
      {...props}
    />
  );
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption };
