import { PERMISSION, type DefaultRoleTemplate } from '@project/authorization';

const inventory = PERMISSION.inventory;
export const inventoryDemoRoles = [
  {
    id: 'inventory-demo-operator',
    name: 'Demo Inventory Operator',
    description: 'Configure Inventory and post movements and physical disposal.',
    permissions: [
      inventory.read,
      inventory.configure,
      inventory.postTransactions,
      inventory.manageAssets,
      inventory.dispose,
    ],
  },
  {
    id: 'inventory-demo-requester',
    name: 'Demo Inventory Requester',
    description: 'Submit removal proposals and revise returned requests.',
    permissions: [inventory.requestRemoval],
  },
  {
    id: 'inventory-demo-reviewer',
    name: 'Demo Inventory Reviewer',
    description: 'Review and route Inventory removal requests.',
    permissions: [inventory.reviewRemoval, PERMISSION.workflow.monitor],
  },
  {
    id: 'inventory-demo-recorder',
    name: 'Demo Inventory Recorder',
    description: 'Record Inventory committee decisions.',
    permissions: [inventory.decideRemoval],
  },
] as const satisfies readonly DefaultRoleTemplate[];
