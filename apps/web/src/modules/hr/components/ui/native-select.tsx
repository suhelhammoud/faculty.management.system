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
        className={cn(
          'hr:h-9 hr:w-full hr:min-w-0 hr:appearance-none hr:rounded-md hr:border hr:border-input hr:bg-transparent hr:px-3 hr:py-2 hr:pe-9 hr:text-sm hr:shadow-xs hr:transition-[color,box-shadow] hr:outline-none hr:selection:bg-primary hr:selection:text-primary-foreground hr:placeholder:text-muted-foreground hr:disabled:pointer-events-none hr:disabled:cursor-not-allowed hr:data-[size=sm]:h-8 hr:data-[size=sm]:py-1 ',
          'hr:focus-visible:border-ring hr:focus-visible:ring-[3px] hr:focus-visible:ring-ring/50',
          'hr:aria-invalid:border-destructive hr:aria-invalid:ring-destructive/20 ',
          className,
        )}
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
