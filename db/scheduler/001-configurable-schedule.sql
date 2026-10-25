CREATE SCHEMA atlas_scheduler;
REVOKE ALL ON SCHEMA atlas_scheduler FROM PUBLIC;
CREATE TABLE atlas_scheduler.schema_version(
 version integer PRIMARY KEY CHECK(version=1),
 migration_hash bytea NOT NULL CHECK(octet_length(migration_hash)=32),
 structure_hash bytea NOT NULL CHECK(octet_length(structure_hash)=32),
 original_history_hash bytea NOT NULL CHECK(octet_length(original_history_hash)=32),
 history_hash bytea NOT NULL CHECK(octet_length(history_hash)=32)
);
-- Additive only: existing days, runs, timestamps and immutable guards stay intact.
CREATE TABLE atlas_scheduler.arkham_policy(
 effective_day date PRIMARY KEY CHECK(isfinite(effective_day)),
 interval_ms integer NOT NULL CHECK(interval_ms IN (300000,900000,1800000,3600000,7200000,21600000,43200000,86400000)),
 budget integer NOT NULL CHECK(budget BETWEEN 1 AND 288 AND budget<=86400000/interval_ms),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- v4's legacy policy, not a rewrite or certification of historical day budgets.
INSERT INTO atlas_scheduler.arkham_policy(effective_day,interval_ms,budget) VALUES('0001-01-01',300000,288);
CREATE FUNCTION atlas_scheduler.policy_insert() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF NOT pg_try_advisory_xact_lock(18471234,405) THEN RAISE EXCEPTION 'SCHEDULER_LOCKED' USING ERRCODE='23514'; END IF;
 PERFORM pg_advisory_xact_lock(18471234,404);
 IF NEW.effective_day <= (clock_timestamp() AT TIME ZONE 'UTC')::date
 OR NEW.effective_day <= (SELECT max(effective_day) FROM atlas_scheduler.arkham_policy)
 OR EXISTS(SELECT 1 FROM atlas_history.scheduler_day WHERE job='ARKHAM' AND day>=NEW.effective_day)
 OR EXISTS(SELECT 1 FROM atlas_history.scheduler_run WHERE job='ARKHAM' AND state='CLAIMED') THEN
  RAISE EXCEPTION 'SCHEDULER_POLICY_CONFLICT' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION atlas_scheduler.reservation_policy() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE p atlas_scheduler.arkham_policy; target_day date;
BEGIN
 IF NEW.job<>'ARKHAM' THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(18471234,404);
 IF TG_TABLE_NAME='scheduler_day' THEN target_day := NEW.day; ELSE target_day := (NEW.slot AT TIME ZONE 'UTC')::date; END IF;
 SELECT * INTO p FROM atlas_scheduler.arkham_policy WHERE effective_day<=target_day ORDER BY effective_day DESC LIMIT 1;
 IF p IS NULL OR current_setting('atlas.arkham_interval_ms',true) IS DISTINCT FROM p.interval_ms::text OR current_setting('atlas.arkham_daily_limit',true) IS DISTINCT FROM p.budget::text THEN RAISE EXCEPTION 'SCHEDULER_POLICY_MISMATCH' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='scheduler_day' THEN
  IF NEW.budget<>p.budget THEN RAISE EXCEPTION 'SCHEDULER_POLICY_MISMATCH' USING ERRCODE='23514'; END IF;
 ELSE
  IF mod(extract(epoch FROM NEW.slot)*1000,p.interval_ms)<>0 THEN RAISE EXCEPTION 'SCHEDULER_POLICY_MISMATCH' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION atlas_scheduler.policy_insert(),atlas_scheduler.reservation_policy() FROM PUBLIC;
CREATE TRIGGER policy_insert BEFORE INSERT ON atlas_scheduler.arkham_policy FOR EACH ROW EXECUTE FUNCTION atlas_scheduler.policy_insert();
CREATE TRIGGER immutable_record BEFORE UPDATE OR DELETE ON atlas_scheduler.arkham_policy FOR EACH ROW EXECUTE FUNCTION atlas_history.reject_mutation();
CREATE TRIGGER arkham_policy BEFORE INSERT ON atlas_history.scheduler_day FOR EACH ROW EXECUTE FUNCTION atlas_scheduler.reservation_policy();
CREATE TRIGGER arkham_policy BEFORE INSERT ON atlas_history.scheduler_run FOR EACH ROW EXECUTE FUNCTION atlas_scheduler.reservation_policy();
ALTER TABLE atlas_scheduler.arkham_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas_scheduler.arkham_policy FORCE ROW LEVEL SECURITY;
REVOKE ALL ON atlas_scheduler.arkham_policy FROM PUBLIC;
ALTER TABLE atlas_scheduler.schema_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas_scheduler.schema_version FORCE ROW LEVEL SECURITY;
REVOKE ALL ON atlas_scheduler.schema_version FROM PUBLIC;
CREATE TRIGGER immutable_record BEFORE UPDATE OR DELETE ON atlas_scheduler.schema_version FOR EACH ROW EXECUTE FUNCTION atlas_history.reject_mutation();
DO $$ DECLARE role_name text; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','authenticator','service_role'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON SCHEMA atlas_scheduler FROM %I',role_name);
   EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA atlas_scheduler FROM %I',role_name);
   EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA atlas_scheduler FROM %I',role_name);
  END IF;
 END LOOP;
END $$;
