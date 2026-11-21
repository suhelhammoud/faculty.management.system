import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/modules/hr/lib/utils';
import { Tabs as TabsPrimitive } from 'radix-ui';

function Tabs({
  className,
  orientation = 'horizontal',
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        'hr:group/tabs hr:flex hr:gap-2 hr:data-[orientation=horizontal]:flex-col',
        className,
      )}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  'hr:group/tabs-list hr:inline-flex hr:w-fit hr:items-center hr:justify-center hr:rounded-lg hr:p-[3px] hr:text-muted-foreground hr:group-data-[orientation=horizontal]/tabs:h-9 hr:group-data-[orientation=vertical]/tabs:h-fit hr:group-data-[orientation=vertical]/tabs:flex-col hr:data-[variant=line]:rounded-none',
  {
    variants: {
      variant: {
        default: 'hr:bg-muted',
        line: 'hr:gap-1 hr:bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function TabsList({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "hr:relative hr:inline-flex hr:h-[calc(100%-1px)] hr:flex-1 hr:items-center hr:justify-center hr:gap-1.5 hr:rounded-md hr:border hr:border-transparent hr:px-2 hr:py-1 hr:text-sm hr:font-medium hr:whitespace-nowrap hr:text-foreground/60 hr:transition-all hr:group-data-[orientation=vertical]/tabs:w-full hr:group-data-[orientation=vertical]/tabs:justify-start hr:hover:text-foreground hr:focus-visible:border-ring hr:focus-visible:ring-[3px] hr:focus-visible:ring-ring/50 hr:focus-visible:outline-1 hr:focus-visible:outline-ring hr:disabled:pointer-events-none hr:disabled:opacity-50 hr:group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm hr:group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none hr:[&_svg]:pointer-events-none hr:[&_svg]:shrink-0 hr:[&_svg:not([class*='size-'])]:size-4",
        'hr:group-data-[variant=line]/tabs-list:bg-transparent hr:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent ',
        'hr:data-[state=active]:bg-background hr:data-[state=active]:text-foreground ',
        'hr:after:absolute hr:after:bg-foreground hr:after:opacity-0 hr:after:transition-opacity hr:group-data-[orientation=horizontal]/tabs:after:inset-x-0 hr:group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] hr:group-data-[orientation=horizontal]/tabs:after:h-0.5 hr:group-data-[orientation=vertical]/tabs:after:inset-y-0 hr:group-data-[orientation=vertical]/tabs:after:-right-1 hr:group-data-[orientation=vertical]/tabs:after:w-0.5 hr:group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100',
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('hr:flex-1 hr:outline-none', className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
