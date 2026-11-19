import { inventoryConditions } from '../../../schema/inventory/index.js';
import type {
  EmployeeSeed,
  FacilitiesSeed,
  InventorySeed,
  SeedRoom,
} from '../../fixtures/local/types.js';

export const roomKey = ({ buildingCode, roomCode }: SeedRoom) =>
  JSON.stringify([buildingCode, roomCode]);

function assertUnique(values: string[], label: string) {
  if (new Set(values).size !== values.length) throw new Error(`Duplicate Inventory ${label}`);
}

function validDate(date: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date
  );
}

export function validateInventory(
  seed: InventorySeed,
  facilities: FacilitiesSeed,
  employees: EmployeeSeed[],
) {
  const assets = seed.receipts.flatMap(({ assets }) => assets);
  const batches = [...seed.receipts, ...seed.issues];
  const identified = [...seed.sharedAccounts, ...seed.consumables, ...assets, ...batches];
  if (
    identified.some(
      ({ id, name }) =>
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id) ||
        !name.trim(),
    )
  )
    throw new Error('Inventory fixtures require stable UUIDs and names');
  assertUnique(
    identified.map(({ id }) => id),
    'fixture ID',
  );
  assertUnique(
    seed.sharedAccounts.map(({ name }) => name),
    'shared account name',
  );
  assertUnique(seed.storage.map(roomKey), 'storage room');
  assertUnique(
    seed.consumables.map(({ code }) => code),
    'consumable code',
  );
  assertUnique(
    assets.map(({ tag }) => tag),
    'asset tag',
  );
  assertUnique(
    batches.map(({ reference }) => reference),
    'transaction reference',
  );
  assertUnique(
    seed.issues.map(({ assetTag }) => assetTag),
    'opening issue asset',
  );
  const rooms = new Set(
    facilities.rooms.filter(({ status }) => !status || status === 'active').map(roomKey),
  );
  const accounts = new Set(seed.sharedAccounts.map(({ id }) => id));
  const storage = new Set(seed.storage.map(roomKey));
  const codes = new Set(seed.consumables.map(({ code }) => code));
  const employeeNumbers = new Set(employees.map(({ employeeNumber }) => employeeNumber));
  const received = new Map(
    seed.receipts.flatMap((batch) =>
      batch.assets.map(({ tag }) => [tag, batch.eventDate] as const),
    ),
  );
  for (const entry of seed.storage) {
    if (!rooms.has(roomKey(entry)))
      throw new Error(`Unknown active Inventory storage room ${entry.roomCode}`);
    if (!accounts.has(entry.sharedAccountId))
      throw new Error(`Unknown Inventory shared custodian for ${entry.roomCode}`);
  }
  if (
    batches.some(
      ({ eventDate, reference }) => !validDate(eventDate) || !reference.startsWith('DEMO-INV-'),
    )
  )
    throw new Error('Invalid Inventory transaction date or reference');
  if (seed.consumables.some(({ code, unit }) => !code.startsWith('DEMO-INV-') || !unit.trim()))
    throw new Error('Invalid Inventory consumable code or unit');
  if (
    assets.some(
      ({ tag, condition }) =>
        !tag.startsWith('DEMO-INV-') || !inventoryConditions.includes(condition),
    )
  )
    throw new Error('Invalid Inventory asset tag or condition');
  for (const receipt of seed.receipts) {
    if (!storage.has(roomKey(receipt.room)))
      throw new Error(`Unknown Inventory receipt storage ${receipt.room.roomCode}`);
    if (!['purchase', 'head-administration'].includes(receipt.source))
      throw new Error('Invalid Inventory receipt source');
    if (!receipt.assets.length && !receipt.stock.length)
      throw new Error(`Empty Inventory receipt ${receipt.reference}`);
    assertUnique(
      receipt.stock.map(({ code }) => code),
      'receipt stock code',
    );
    for (const { code, quantity } of receipt.stock) {
      if (!codes.has(code)) throw new Error(`Unknown Inventory consumable ${code}`);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 2147483647)
        throw new Error(`Invalid Inventory stock quantity for ${code}`);
    }
  }
  for (const issue of seed.issues) {
    const receiptDate = received.get(issue.assetTag);
    if (!receiptDate || issue.eventDate < receiptDate)
      throw new Error(`Invalid Inventory issue for ${issue.assetTag}`);
    if (!employeeNumbers.has(issue.employeeNumber))
      throw new Error(`Unknown Inventory employee ${issue.employeeNumber}`);
    if (issue.room && !rooms.has(roomKey(issue.room)))
      throw new Error(`Unknown Inventory issue room ${issue.room.roomCode}`);
  }
}
