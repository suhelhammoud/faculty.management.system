import * as React from 'react';
import { cn } from '@/modules/inventory/lib/utils';
import { ChevronDownIcon } from 'lucide-react';

function NativeSelect({
  className,
  size = 'default',
  ...props
}: Omit<React.ComponentProps<'select'>, 'size'> & { size?: 'sm' | 'default' }) {
  return (
    <div
      className="inv:group/native-select inv:relative inv:w-fit inv:has-[select:disabled]:opacity-50"
      data-slot="native-select-wrapper"
    >
      <select
        data-slot="native-select"
        data-size={size}
        className={cn('inv:appearance-none', className)}
        {...props}
      />
      <ChevronDownIcon
        className="inv:pointer-events-none inv:absolute inv:top-1/2 inv:end-3.5 inv:size-4 inv:-translate-y-1/2 inv:text-muted-foreground inv:opacity-50 inv:select-none"
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
      className={cn('inv:bg-[Canvas] inv:text-[CanvasText]', className)}
      {...props}
    />
  );
}

function NativeSelectOptGroup({ className, ...props }: React.ComponentProps<'optgroup'>) {
  return (
    <optgroup
      data-slot="native-select-optgroup"
      className={cn('inv:bg-[Canvas] inv:text-[CanvasText]', className)}
      {...props}
    />
  );
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption };
