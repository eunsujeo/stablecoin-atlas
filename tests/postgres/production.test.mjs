import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
import {connectDatabase} from '../../tools/market-db/connection.mjs';
import {initialize,grantAccess} from '../../tools/market-db/schema.mjs';
import {verifyProductionReader,productionConnector} from '../../tools/production-database.mjs';

test('owned PG17 fixture proves reader-only session, writer/inherited/PUBLIC/column/function/ownership rejection without changing a real database',async()=>{
  const f=await fixture();const clients=[];
  const connect=async url=>{const c=await connectDatabase({DATABASE_URL:url});clients.push(c);return c;};
  try{
    await initialize(f.admin);
    const readerURL=await f.createUser('atlas_test_reader'),writerURL=await f.createUser('atlas_test_writer');
    await grantAccess(f.admin,'atlas_test_reader','reader');await grantAccess(f.admin,'atlas_test_writer','writer');
    const reader=await connect(readerURL),writer=await connect(writerURL);
    assert.deepEqual(await verifyProductionReader(reader),{state:'READER_READY'});
    await assert.rejects(reader.query('SELECT atlas_market.reject_mutation()'),e=>/trigger functions can only be called as triggers/.test(e.message));
    assert.equal((await reader.query("SELECT has_schema_privilege(current_user,'atlas_market','CREATE') AS create,has_table_privilege(current_user,'atlas_market.coin','TRIGGER') AS trigger")).rows[0].create,false);
    assert.equal((await reader.query('SHOW default_transaction_read_only')).rows[0].default_transaction_read_only,'on');
    assert.equal((await reader.query('SELECT count(*)::text FROM atlas_market.coin')).rows[0].count,'0');
    await assert.rejects(reader.query('INSERT INTO atlas_market.coin(code,symbol,name) VALUES(\'x\',\'X\',\'X\')'),e=>['25006','42501'].includes(e.code));
    await assert.rejects(verifyProductionReader(writer),/READER_REQUIRED/);
    await f.admin.query('GRANT atlas_test_writer TO atlas_test_reader');await assert.rejects(verifyProductionReader(reader),/PRIVILEGES_UNSAFE/);await f.admin.query('REVOKE atlas_test_writer FROM atlas_test_reader');
    await f.admin.query('GRANT atlas_test_writer TO atlas_test_reader WITH INHERIT FALSE');assert.equal((await reader.query("SELECT has_table_privilege(current_user,'atlas_market.coin','INSERT') AS insert")).rows[0].insert,false);await assert.rejects(verifyProductionReader(reader),/PRIVILEGES_UNSAFE/);await f.admin.query('REVOKE atlas_test_writer FROM atlas_test_reader');
    await f.admin.query('GRANT UPDATE(name) ON atlas_market.coin TO PUBLIC');await assert.rejects(verifyProductionReader(reader),/PRIVILEGES_UNSAFE/);await f.admin.query('REVOKE UPDATE(name) ON atlas_market.coin FROM PUBLIC');
    await f.admin.query('CREATE SCHEMA atlas_web_guard; CREATE TABLE atlas_web_guard.owned(x int); GRANT USAGE ON SCHEMA atlas_web_guard TO atlas_test_reader; ALTER TABLE atlas_web_guard.owned OWNER TO atlas_test_reader');
    await assert.rejects(verifyProductionReader(reader),/PRIVILEGES_UNSAFE/);await f.admin.query('ALTER TABLE atlas_web_guard.owned OWNER TO postgres');
    await f.admin.query('CREATE FUNCTION atlas_web_guard.mutate() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$');await assert.rejects(verifyProductionReader(reader),/PRIVILEGES_UNSAFE/);await f.admin.query('REVOKE EXECUTE ON FUNCTION atlas_web_guard.mutate() FROM PUBLIC');
    await f.admin.query('CREATE FUNCTION atlas_web_guard.trigger_only() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$');
    assert.deepEqual(await verifyProductionReader(reader),{state:'READER_READY'});
    await f.admin.query('ALTER FUNCTION atlas_web_guard.trigger_only() SECURITY DEFINER');await assert.rejects(verifyProductionReader(reader),/PRIVILEGES_UNSAFE/);
    await f.admin.query('ALTER FUNCTION atlas_web_guard.trigger_only() SECURITY INVOKER');
    await f.admin.query('CREATE FUNCTION atlas_web_guard.event_only() RETURNS event_trigger LANGUAGE plpgsql AS $$ BEGIN END $$');await assert.rejects(verifyProductionReader(reader),/PRIVILEGES_UNSAFE/);await f.admin.query('REVOKE EXECUTE ON FUNCTION atlas_web_guard.event_only() FROM PUBLIC');
    await f.admin.query('CREATE SEQUENCE atlas_web_guard.seq; GRANT USAGE ON SEQUENCE atlas_web_guard.seq TO PUBLIC');await assert.rejects(verifyProductionReader(reader),/PRIVILEGES_UNSAFE/);await f.admin.query('REVOKE USAGE ON SEQUENCE atlas_web_guard.seq FROM PUBLIC');
    await reader.query('SET default_transaction_read_only=off');
    await assert.rejects(reader.query("INSERT INTO atlas_market.coin(code,symbol,name) VALUES('x','X','X')"),e=>e.code==='42501');
    await assert.rejects(reader.query('CREATE TABLE atlas_market.forbidden(x int)'),e=>e.code==='42501');
    // Test-only transport injection: fixture has no TLS; production config still requires TLS.
    const connector=productionConnector({DATABASE_URL:'postgresql://reader:fixture-only@fixture.invalid/db?sslmode=verify-full'},{limit:1,queueLimit:0,open:()=>connectDatabase({DATABASE_URL:readerURL})});
    try{
      const lease=await connector.connect();await assert.rejects(connector.connect(),/BUSY/);
      const pid=(await lease.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      await lease.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      assert.equal((await lease.query('SELECT count(*)::text AS count FROM atlas_market.coin')).rows[0].count,'0');
      await f.admin.query("INSERT INTO atlas_market.coin(code,symbol,name) VALUES('x','X','X')");
      assert.equal((await lease.query('SELECT count(*)::text AS count FROM atlas_market.coin')).rows[0].count,'0');
      await lease.query('COMMIT');await lease.end();assert.equal(connector.active,0);
      const reused=await connector.connect();assert.equal((await reused.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,pid);
      assert.equal((await reused.query('SHOW default_transaction_read_only')).rows[0].default_transaction_read_only,'on');
      assert.equal((await reused.query('SELECT count(*)::text AS count FROM atlas_market.coin')).rows[0].count,'1');
      await assert.rejects(lease.query('SELECT 1'),/LEASE_CLOSED/);await reused.end();
      // A reused connection must detect grants changed after its previous lease.
      await f.admin.query('GRANT UPDATE(name) ON atlas_market.coin TO PUBLIC');
      await assert.rejects(connector.connect(),/READER_UNAVAILABLE/);
      await f.admin.query('REVOKE UPDATE(name) ON atlas_market.coin FROM PUBLIC');
      const recovered=await connector.connect();
      await assert.rejects(recovered.query("UPDATE atlas_market.coin SET name='forbidden'"),e=>['25006','42501'].includes(e.code));
      await recovered.end();
    }finally{await connector.close();}
  }finally{await Promise.allSettled(clients.map(c=>c.end()));await f.stop();}
});
