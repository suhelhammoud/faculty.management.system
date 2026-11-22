import { expect, it } from 'vitest';
import { inventoryRemoval } from '../inventory/inventory-removal.definition.js';
import { designSchema, exportDesign, templateDraft } from './designer-model.js';
it('round trips inventory removal and retains references when a step key changes', () => {
  const draft = designSchema.parse(templateDraft(inventoryRemoval));
  expect(exportDesign(draft)).toEqual(inventoryRemoval);
  draft.steps[0].key = 'review-again';
  expect(exportDesign(draft).steps.revise.actions.resubmit).toEqual({ next: 'review-again' });
});
it('permits incomplete drafts but rejects unreachable steps on export', () => {
  const draft = templateDraft(inventoryRemoval);
  draft.steps[0].actions = [];
  expect(designSchema.safeParse(draft).success).toBe(true);
  expect(() => exportDesign(draft)).toThrow();
});
