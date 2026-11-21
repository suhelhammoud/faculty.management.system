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
        className={cn(
          'inv:h-9 inv:w-full inv:min-w-0 inv:appearance-none inv:rounded-md inv:border inv:border-input inv:bg-transparent inv:px-3 inv:py-2 inv:pe-9 inv:text-sm inv:shadow-xs inv:transition-[color,box-shadow] inv:outline-none inv:selection:bg-primary inv:selection:text-primary-foreground inv:placeholder:text-muted-foreground inv:disabled:pointer-events-none inv:disabled:cursor-not-allowed inv:data-[size=sm]:h-8 inv:data-[size=sm]:py-1 ',
          'inv:focus-visible:border-ring inv:focus-visible:ring-[3px] inv:focus-visible:ring-ring/50',
          'inv:aria-invalid:border-destructive inv:aria-invalid:ring-destructive/20 ',
          className,
        )}
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
