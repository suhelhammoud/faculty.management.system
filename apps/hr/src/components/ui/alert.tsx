import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const alertVariants = cva(
  'hr:relative hr:grid hr:w-full hr:grid-cols-[0_1fr] hr:items-start hr:gap-y-0.5 hr:rounded-lg hr:border hr:px-4 hr:py-3 hr:text-sm hr:has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] hr:has-[>svg]:gap-x-3 hr:[&>svg]:size-4 hr:[&>svg]:translate-y-0.5 hr:[&>svg]:text-current',
  {
    variants: {
      variant: {
        default: 'hr:bg-card hr:text-card-foreground',
        destructive:
          'hr:bg-card hr:text-destructive hr:*:data-[slot=alert-description]:text-destructive/90 hr:[&>svg]:text-current',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        'hr:col-start-2 hr:line-clamp-1 hr:min-h-4 hr:font-medium hr:tracking-tight',
        className,
      )}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        'hr:col-start-2 hr:grid hr:justify-items-start hr:gap-1 hr:text-sm hr:text-muted-foreground hr:[&_p]:leading-relaxed',
        className,
      )}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription };
