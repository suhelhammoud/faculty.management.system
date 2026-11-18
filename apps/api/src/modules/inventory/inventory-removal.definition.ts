import { PERMISSION } from '@project/authorization';
import type { WorkflowDefinition } from '../workflows/workflow-definition.js';

type RemovalStep = 'review' | 'revise' | 'committee-decision';

export const inventoryRemoval = {
  key: 'inventory.removal',
  version: 1,
  title: 'Asset removal review',
  description: 'Reviews proposed assets and records the removal decision.',
  initialStep: 'review',
  steps: {
    review: {
      title: 'Review request',
      instructions: 'Review the proposed assets and the reasons for removal.',
      eligible: { permission: PERMISSION.inventory.reviewRemoval },
      actions: {
        forward: { next: 'committee-decision' },
        return: { next: 'revise' },
        reject: { finish: 'rejected' },
      },
    },
    revise: {
      title: 'Revise request',
      instructions: 'Address the review comments and resubmit the proposal.',
      eligible: { requester: true },
      actions: { resubmit: { next: 'review' } },
    },
    'committee-decision': {
      title: 'Record committee decision',
      instructions: 'Record an outcome and reason for each proposed asset.',
      eligible: { permission: PERMISSION.inventory.decideRemoval },
      actions: {
        'record-decision': { finish: 'completed' },
        return: { next: 'revise' },
      },
    },
  },
} satisfies WorkflowDefinition<RemovalStep>;
