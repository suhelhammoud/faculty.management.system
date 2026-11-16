import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Slot } from 'radix-ui';

const buttonVariants = cva(
  "hr:inline-flex hr:shrink-0 hr:items-center hr:justify-center hr:gap-2 hr:rounded-md hr:text-sm hr:font-medium hr:whitespace-nowrap hr:transition-all hr:outline-none hr:focus-visible:border-ring hr:focus-visible:ring-[3px] hr:focus-visible:ring-ring/50 hr:disabled:pointer-events-none hr:disabled:opacity-50 hr:aria-invalid:border-destructive hr:aria-invalid:ring-destructive/20 hr:[&_svg]:pointer-events-none hr:[&_svg]:shrink-0 hr:[&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'hr:bg-primary hr:text-primary-foreground hr:hover:bg-primary/90',
        destructive:
          'hr:bg-destructive hr:text-white hr:hover:bg-destructive/90 hr:focus-visible:ring-destructive/20 ',
        outline:
          'hr:border hr:bg-background hr:shadow-xs hr:hover:bg-accent hr:hover:text-accent-foreground ',
        secondary: 'hr:bg-secondary hr:text-secondary-foreground hr:hover:bg-secondary/80',
        ghost: 'hr:hover:bg-accent hr:hover:text-accent-foreground ',
        link: 'hr:text-primary hr:underline-offset-4 hr:hover:underline',
      },
      size: {
        default: 'hr:h-9 hr:px-4 hr:py-2 hr:has-[>svg]:px-3',
        xs: "hr:h-6 hr:gap-1 hr:rounded-md hr:px-2 hr:text-xs hr:has-[>svg]:px-1.5 hr:[&_svg:not([class*='size-'])]:size-3",
        sm: 'hr:h-8 hr:gap-1.5 hr:rounded-md hr:px-3 hr:has-[>svg]:px-2.5',
        lg: 'hr:h-10 hr:rounded-md hr:px-6 hr:has-[>svg]:px-4',
        icon: 'hr:size-9',
        'icon-xs': "hr:size-6 hr:rounded-md hr:[&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'hr:size-8',
        'icon-lg': 'hr:size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button };
