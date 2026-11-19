import { createInput } from '@project/ui/form-primitives';
import { cn } from '@/lib/utils';

export const Input = createInput(
  cn,
  'hr:h-9 hr:w-full hr:min-w-0 hr:rounded-md hr:border hr:border-input hr:bg-transparent hr:px-3 hr:py-1 hr:text-base hr:shadow-xs hr:transition-[color,box-shadow] hr:outline-none hr:selection:bg-primary hr:selection:text-primary-foreground hr:file:inline-flex hr:file:h-7 hr:file:border-0 hr:file:bg-transparent hr:file:text-sm hr:file:font-medium hr:file:text-foreground hr:placeholder:text-muted-foreground hr:disabled:pointer-events-none hr:disabled:cursor-not-allowed hr:disabled:opacity-50 hr:md:text-sm ',
  'hr:focus-visible:border-ring hr:focus-visible:ring-[3px] hr:focus-visible:ring-ring/50',
  'hr:aria-invalid:border-destructive hr:aria-invalid:ring-destructive/20 ',
);
