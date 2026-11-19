import { createButton } from '@project/ui/form-primitives';
import { cn } from '@/lib/utils';

export const Button = createButton(
  cn,
  "inv:inline-flex inv:shrink-0 inv:items-center inv:justify-center inv:gap-2 inv:rounded-md inv:text-sm inv:font-medium inv:whitespace-nowrap inv:transition-all inv:outline-none inv:focus-visible:border-ring inv:focus-visible:ring-[3px] inv:focus-visible:ring-ring/50 inv:disabled:pointer-events-none inv:disabled:opacity-50 inv:aria-invalid:border-destructive inv:aria-invalid:ring-destructive/20 inv:[&_svg]:pointer-events-none inv:[&_svg]:shrink-0 inv:[&_svg:not([class*='size-'])]:size-4",
  {
    variant: {
      default: 'inv:bg-primary inv:text-primary-foreground inv:hover:bg-primary/90',
      destructive:
        'inv:bg-destructive inv:text-white inv:hover:bg-destructive/90 inv:focus-visible:ring-destructive/20 ',
      outline:
        'inv:border inv:bg-background inv:shadow-xs inv:hover:bg-accent inv:hover:text-accent-foreground ',
      secondary: 'inv:bg-secondary inv:text-secondary-foreground inv:hover:bg-secondary/80',
      ghost: 'inv:hover:bg-accent inv:hover:text-accent-foreground ',
      link: 'inv:text-primary inv:underline-offset-4 inv:hover:underline',
    },
    size: {
      default: 'inv:h-9 inv:px-4 inv:py-2 inv:has-[>svg]:px-3',
      xs: "inv:h-6 inv:gap-1 inv:rounded-md inv:px-2 inv:text-xs inv:has-[>svg]:px-1.5 inv:[&_svg:not([class*='size-'])]:size-3",
      sm: 'inv:h-8 inv:gap-1.5 inv:rounded-md inv:px-3 inv:has-[>svg]:px-2.5',
      lg: 'inv:h-10 inv:rounded-md inv:px-6 inv:has-[>svg]:px-4',
      icon: 'inv:size-9',
      'icon-xs': "inv:size-6 inv:rounded-md inv:[&_svg:not([class*='size-'])]:size-3",
      'icon-sm': 'inv:size-8',
      'icon-lg': 'inv:size-10',
    },
  },
);
