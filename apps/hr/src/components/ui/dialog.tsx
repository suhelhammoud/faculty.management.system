import * as React from 'react';
import { cn } from '@/lib/utils';
import { XIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';

import { Button } from '@/components/ui/button';

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        'hr:fixed hr:inset-0 hr:z-50 hr:bg-black/50 hr:data-[state=closed]:animate-out hr:data-[state=closed]:fade-out-0 hr:data-[state=open]:animate-in hr:data-[state=open]:fade-in-0',
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
}) {
  return (
    <DialogPortal
      data-slot="dialog-portal"
      container={document.querySelector<HTMLElement>('.faculty-hr')}
    >
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          'hr:fixed hr:top-[50%] hr:left-[50%] hr:z-50 hr:grid hr:w-full hr:max-w-[calc(100%-2rem)] hr:translate-x-[-50%] hr:translate-y-[-50%] hr:gap-4 hr:rounded-lg hr:border hr:bg-background hr:p-6 hr:shadow-lg hr:duration-200 hr:outline-none hr:data-[state=closed]:animate-out hr:data-[state=closed]:fade-out-0 hr:data-[state=closed]:zoom-out-95 hr:data-[state=open]:animate-in hr:data-[state=open]:fade-in-0 hr:data-[state=open]:zoom-in-95 hr:sm:max-w-lg',
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="hr:absolute hr:top-4 hr:end-4 hr:rounded-xs hr:opacity-70 hr:ring-offset-background hr:transition-opacity hr:hover:opacity-100 hr:focus:ring-2 hr:focus:ring-ring hr:focus:ring-offset-2 hr:focus:outline-hidden hr:disabled:pointer-events-none hr:data-[state=open]:bg-accent hr:data-[state=open]:text-muted-foreground hr:[&_svg]:pointer-events-none hr:[&_svg]:shrink-0 hr:[&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="hr:sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('hr:flex hr:flex-col hr:gap-2 hr:text-center hr:sm:text-start', className)}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  showCloseButton?: boolean;
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        'hr:flex hr:flex-col-reverse hr:gap-2 hr:sm:flex-row hr:sm:justify-end',
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('hr:text-lg hr:leading-none hr:font-semibold', className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('hr:text-sm hr:text-muted-foreground', className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
