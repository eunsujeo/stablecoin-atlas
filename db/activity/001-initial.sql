CREATE SCHEMA atlas_activity;
REVOKE ALL ON SCHEMA atlas_activity FROM PUBLIC;
CREATE TABLE atlas_activity.schema_version(version integer PRIMARY KEY CHECK(version=1),migration_hash bytea NOT NULL CHECK(octet_length(migration_hash)=32),structure_hash bytea NOT NULL CHECK(octet_length(structure_hash)=32));
CREATE TABLE atlas_activity.access_grant(role_name name PRIMARY KEY,access_mode text NOT NULL CHECK(access_mode IN ('reader','writer')));
CREATE TABLE atlas_activity.source(
 id bytea PRIMARY KEY CHECK(octet_length(id)=32),source_hash bytea NOT NULL CHECK(octet_length(source_hash)=32),
 mapper text NOT NULL CHECK(mapper='allium-ethereum-transfers-v1'),provider text NOT NULL CHECK(provider='ALLIUM'),
 queried_at timestamptz NOT NULL,imported_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 window_from date NOT NULL,window_to date NOT NULL,rows_hash bytea NOT NULL CHECK(octet_length(rows_hash)=32),
 CHECK(window_to>=window_from AND window_to-window_from<=30 AND window_to<(queried_at AT TIME ZONE 'UTC')::date),
 UNIQUE(source_hash,mapper)
);
CREATE TABLE atlas_activity.daily_value(
 source_id bytea NOT NULL REFERENCES atlas_activity.source(id),
 coin text NOT NULL CHECK(coin IN ('usdt','usdc','rlusd','jpyc','jpysc')),
 network text NOT NULL CHECK(network='ethereum'),observed_day date NOT NULL,
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object' AND octet_length(payload::text)<=4096),
 value_hash bytea NOT NULL CHECK(octet_length(value_hash)=32),
 PRIMARY KEY(source_id,coin,network,observed_day)
);
CREATE INDEX activity_daily_lookup ON atlas_activity.daily_value(coin,network,observed_day DESC,source_id);
CREATE FUNCTION atlas_activity.reject_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN RAISE EXCEPTION 'IMMUTABLE_ACTIVITY_RECORD' USING ERRCODE='23514'; END $$;
REVOKE ALL ON FUNCTION atlas_activity.reject_mutation() FROM PUBLIC;
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['schema_version','access_grant','source','daily_value'] LOOP
  EXECUTE format('ALTER TABLE atlas_activity.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE atlas_activity.%I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('REVOKE ALL ON atlas_activity.%I FROM PUBLIC',tab);
  EXECUTE format('CREATE TRIGGER immutable_record BEFORE UPDATE OR DELETE ON atlas_activity.%I FOR EACH ROW EXECUTE FUNCTION atlas_activity.reject_mutation()',tab);
 END LOOP;
END $$;
DO $$ DECLARE exposed text; BEGIN
 FOREACH exposed IN ARRAY ARRAY['anon','authenticated','authenticator','service_role'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=exposed) THEN
   EXECUTE format('REVOKE ALL ON SCHEMA atlas_activity FROM %I',exposed);
   EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA atlas_activity FROM %I',exposed);
   EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA atlas_activity FROM %I',exposed);
  END IF;
 END LOOP;
END $$;
