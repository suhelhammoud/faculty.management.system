import { createLabel } from '@project/ui/form-primitives';
import { cn } from '@/lib/utils';

export const Label = createLabel(
  cn,
  'hr:flex hr:items-center hr:gap-2 hr:text-sm hr:leading-none hr:font-medium hr:select-none hr:group-data-[disabled=true]:pointer-events-none hr:group-data-[disabled=true]:opacity-50 hr:peer-disabled:cursor-not-allowed hr:peer-disabled:opacity-50',
);
