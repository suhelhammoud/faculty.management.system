import { createLabel } from '@project/ui/form-primitives';
import { cn } from '@/modules/inventory/lib/utils';

export const Label = createLabel(
  cn,
  'inv:flex inv:items-center inv:gap-2 inv:text-sm inv:leading-none inv:font-medium inv:select-none inv:group-data-[disabled=true]:pointer-events-none inv:group-data-[disabled=true]:opacity-50 inv:peer-disabled:cursor-not-allowed inv:peer-disabled:opacity-50',
);
