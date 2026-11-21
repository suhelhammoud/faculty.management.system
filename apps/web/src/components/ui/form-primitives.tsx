import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Label as LabelPrimitive, Slot } from 'radix-ui';

type MergeClasses = (...classes: (string | undefined)[]) => string;

type ButtonStyles = {
  variant: Record<'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link', string>;
  size: Record<'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg', string>;
};

export function createButton(mergeClasses: MergeClasses, base = '', variants?: ButtonStyles) {
  const buttonVariants = cva(base, {
    variants,
    defaultVariants: { variant: 'default', size: 'default' },
  });

  return function Button({
    className,
    variant = 'default',
    size = 'default',
    asChild = false,
    ...props
  }: ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
    const Comp = asChild ? Slot.Root : 'button';

    return (
      <Comp
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={mergeClasses(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  };
}

export function createInput(mergeClasses: MergeClasses, ...classes: string[]) {
  return function Input({ className, type, ...props }: ComponentProps<'input'>) {
    return (
      <input
        type={type}
        data-slot="input"
        className={mergeClasses(...classes, className)}
        {...props}
      />
    );
  };
}

export function createLabel(mergeClasses: MergeClasses, classes: string) {
  return function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
    return (
      <LabelPrimitive.Root
        data-slot="label"
        className={mergeClasses(classes, className)}
        {...props}
      />
    );
  };
}
