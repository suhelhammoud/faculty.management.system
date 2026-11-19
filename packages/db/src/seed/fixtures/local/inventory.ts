import type { InventorySeed } from './types.js';

const main = { buildingCode: 'FACULTY_MAIN', roomCode: 'demo_inventory_main' };
const annex = { buildingCode: 'FACULTY_MAIN', roomCode: 'demo_inventory_annex' };

export const localInventory = {
  sharedAccounts: [
    { id: 'd06a0000-0000-4000-8000-000000000001', name: 'Demo Inventory Main Store' },
    { id: 'd06a0000-0000-4000-8000-000000000002', name: 'Demo Inventory Annex' },
  ],
  storage: [
    { ...main, sharedAccountId: 'd06a0000-0000-4000-8000-000000000001' },
    { ...annex, sharedAccountId: 'd06a0000-0000-4000-8000-000000000002' },
  ],
  consumables: [
    {
      id: 'd06a0000-0000-4000-8000-000000000011',
      code: 'DEMO-INV-PAPER',
      name: 'Copy paper',
      unit: 'ream',
    },
    {
      id: 'd06a0000-0000-4000-8000-000000000012',
      code: 'DEMO-INV-PENS',
      name: 'Blue pens',
      unit: 'box',
    },
    {
      id: 'd06a0000-0000-4000-8000-000000000013',
      code: 'DEMO-INV-CABLE',
      name: 'USB-C cable',
      unit: 'each',
    },
  ],
  receipts: [
    {
      id: 'd06a0000-0000-4000-8000-000000000101',
      reference: 'DEMO-INV-R01',
      name: 'Main store opening receipt',
      eventDate: '2025-01-15',
      source: 'purchase',
      room: main,
      assets: [
        {
          id: 'd06a0000-0000-4000-8000-000000000021',
          tag: 'DEMO-INV-001',
          name: 'Teaching projector',
          category: 'AV',
          condition: 'serviceable',
        },
        {
          id: 'd06a0000-0000-4000-8000-000000000022',
          tag: 'DEMO-INV-002',
          name: 'Loan laptop',
          category: 'Computing',
          condition: 'serviceable',
        },
        {
          id: 'd06a0000-0000-4000-8000-000000000023',
          tag: 'DEMO-INV-003',
          name: 'Projector with lamp failure',
          category: 'AV',
          condition: 'malfunctioning',
        },
        {
          id: 'd06a0000-0000-4000-8000-000000000024',
          tag: 'DEMO-INV-004',
          name: 'Printer with feed fault',
          category: 'Printing',
          condition: 'malfunctioning',
        },
      ],
      stock: [
        { code: 'DEMO-INV-PAPER', quantity: 20 },
        { code: 'DEMO-INV-PENS', quantity: 10 },
      ],
    },
    {
      id: 'd06a0000-0000-4000-8000-000000000102',
      reference: 'DEMO-INV-R02',
      name: 'Annex opening receipt',
      eventDate: '2025-01-15',
      source: 'head-administration',
      room: annex,
      assets: [
        {
          id: 'd06a0000-0000-4000-8000-000000000025',
          tag: 'DEMO-INV-005',
          name: 'UPS awaiting diagnosis',
          category: 'Power',
          condition: 'under-repair',
        },
        {
          id: 'd06a0000-0000-4000-8000-000000000026',
          tag: 'DEMO-INV-006',
          name: 'Spare monitor',
          category: 'Computing',
          condition: 'serviceable',
        },
      ],
      stock: [{ code: 'DEMO-INV-CABLE', quantity: 12 }],
    },
  ],
  issues: [
    {
      id: 'd06a0000-0000-4000-8000-000000000103',
      reference: 'DEMO-INV-I01',
      name: 'Issue teaching projector',
      eventDate: '2025-01-16',
      assetTag: 'DEMO-INV-001',
      employeeNumber: 'DEMO-EMP-004',
      room: { buildingCode: 'FACULTY_MAIN', roomCode: 'lab_01' },
    },
    {
      id: 'd06a0000-0000-4000-8000-000000000104',
      reference: 'DEMO-INV-I02',
      name: 'Issue loan laptop',
      eventDate: '2025-01-16',
      assetTag: 'DEMO-INV-002',
      employeeNumber: 'DEMO-EMP-002',
      room: null,
    },
  ],
} satisfies InventorySeed;
