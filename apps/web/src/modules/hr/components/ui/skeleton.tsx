import { cn } from '@/modules/hr/lib/utils';

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('hr:animate-pulse hr:rounded-md hr:bg-accent', className)}
      {...props}
    />
  );
}

export { Skeleton };
