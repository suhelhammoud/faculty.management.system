import { createDb } from '@project/db';
import {
  user,
  account,
  roles,
  permissions,
  userRoles,
  rolePermissions,
} from '@project/db/schema';
import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
const username = process.env.BOOTSTRAP_USERNAME?.toLowerCase();
const password = process.env.BOOTSTRAP_PASSWORD;
if (
  !username ||
  !/^[a-z0-9_]{3,30}$/.test(username) ||
  !password ||
  password.length < 12 ||
  password.length > 128 ||
  !process.env.DATABASE_URL
)
  throw new Error(
    'Set DATABASE_URL, BOOTSTRAP_USERNAME and BOOTSTRAP_PASSWORD (12–128 characters)',
  );
const { db, pool } = createDb(process.env.DATABASE_URL);
try {
  const hash = await hashPassword(password);
  await db.transaction(
    async (tx) => {
      // SERIALIZABLE prevents two concurrent bootstrap transactions both succeeding.
      if ((await tx.select({ id: user.id }).from(user).limit(1)).length)
        throw new Error('Bootstrap requires an empty user table');
      const id = randomUUID(),
        roleId = randomUUID();
      const keys = [
        'users:read',
        'users:create',
        'users:approve',
        'users:reset-password',
        'users:assign-roles',
        'roles:read',
        'roles:create',
        'roles:update',
        'audit:read',
      ];
      await tx.insert(user).values({
        id,
        username,
        displayUsername: username,
        name: 'Administrator',
        email: `${id}@accounts.invalid`,
        approved: true,
        enabled: true,
        mustChangePassword: true,
      });
      await tx.insert(account).values({
        id: randomUUID(),
        accountId: id,
        providerId: 'credential',
        userId: id,
        password: hash,
      });
      await tx.insert(roles).values({ id: roleId, name: 'Administrator' });
      await tx
        .insert(permissions)
        .values(keys.map((key) => ({ key })))
        .onConflictDoNothing();
      await tx
        .insert(rolePermissions)
        .values(keys.map((permission) => ({ roleId, permission })));
      await tx.insert(userRoles).values({ userId: id, roleId });
    },
    { isolationLevel: 'serializable' },
  );
  console.log('Administrator created. Change the password after signing in.');
} finally {
  await pool.end();
}
