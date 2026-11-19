import { expect, it } from 'vitest';
import { cn } from './utils';

it('merges conflicting Inventory utilities and preserves unrelated classes', () => {
  expect(cn('inv:px-4', 'inv:px-2')).toBe('inv:px-2');
  expect(cn('inv:px-4 inv:py-1', 'inv:px-2 inventory-field')).toBe(
    'inv:py-1 inv:px-2 inventory-field',
  );
});
