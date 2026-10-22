import { transaction, runtimeRole } from './connection.mjs';
import { verifySchema, verifyRuntimeAccess } from './schema.mjs';
import { fail } from './plan.mjs';

export function observationMonth(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) fail('INVALID_PARTITION_MONTH');
  const month = date.toISOString().slice(0, 7);
  if (!/^(20[2-9][0-9]|2100)-(0[1-9]|1[0-2])$/.test(month)) fail('INVALID_PARTITION_MONTH');
  return month;
}
export async function checkDatabase(client, { access = 'writer', at = new Date(), through = at } = {}) {
  if (!['reader', 'writer'].includes(access)) fail('INVALID_ACCESS_MODE');
  const months = [...new Set([observationMonth(at), observationMonth(through)])];
  return transaction(client, async () => {
    await runtimeRole(client); await verifySchema(client); await verifyRuntimeAccess(client, access === 'writer');
    for (const month of months) for (const table of ['observation', 'network_observation']) {
      const name = `atlas_market.${table}_${month.replace('-', '_')}`;
      const { rows: [row] } = await client.query('SELECT to_regclass($1) IS NOT NULL AS present', [name]);
      if (!row.present) fail('DATABASE_PARTITION_REQUIRED');
    }
    return { state: 'READY', access, schemaVersion: 1, months, readonly: true };
  }, { readonly: true });
}
