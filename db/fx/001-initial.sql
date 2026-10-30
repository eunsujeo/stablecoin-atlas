CREATE SCHEMA atlas_fx;
REVOKE ALL ON SCHEMA atlas_fx FROM PUBLIC;
CREATE TABLE atlas_fx.schema_version(version integer PRIMARY KEY CHECK(version=1),migration_hash bytea NOT NULL CHECK(octet_length(migration_hash)=32),structure_hash bytea NOT NULL CHECK(octet_length(structure_hash)=32));
CREATE TABLE atlas_fx.access_grant(role_name name PRIMARY KEY,access_mode text NOT NULL CHECK(access_mode IN ('reader','writer')));
CREATE TABLE atlas_fx.snapshot(
 snapshot_id text PRIMARY KEY CHECK(snapshot_id ~ '^[a-f0-9]{64}$'),
 rate_date date NOT NULL,
 observed_at timestamptz NOT NULL,
 stored_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 payload_hash bytea NOT NULL CHECK(octet_length(payload_hash)=32),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object' AND octet_length(payload::text)<=4096),
 raw_xml bytea NOT NULL CHECK(octet_length(raw_xml) BETWEEN 1 AND 65536),
 CHECK(payload ?& ARRAY['schemaVersion','kind','base','date','usdPerEUR','krwPerEUR','sourceHash','fetchedAt','importedAt']),
 CHECK((payload->>'kind') IS NOT DISTINCT FROM 'ECB_REFERENCE_FX' AND (payload->>'base') IS NOT DISTINCT FROM 'EUR' AND (payload->>'schemaVersion') IS NOT DISTINCT FROM '1'),
 CHECK(jsonb_typeof(payload->'date')='string' AND jsonb_typeof(payload->'usdPerEUR')='string' AND jsonb_typeof(payload->'krwPerEUR')='string' AND jsonb_typeof(payload->'sourceHash')='string'),
 CHECK((jsonb_typeof(payload->'fetchedAt')='string' AND jsonb_typeof(payload->'importedAt')='null') OR (jsonb_typeof(payload->'fetchedAt')='null' AND jsonb_typeof(payload->'importedAt')='string')),
 CHECK((payload->>'date')::date=rate_date AND coalesce(payload->>'fetchedAt',payload->>'importedAt')::timestamptz=observed_at AND rate_date<=(observed_at AT TIME ZONE 'UTC')::date)
);
CREATE FUNCTION atlas_fx.reject_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN RAISE EXCEPTION 'IMMUTABLE_FX' USING ERRCODE='23514'; END $$;
REVOKE ALL ON FUNCTION atlas_fx.reject_mutation() FROM PUBLIC;
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['schema_version','access_grant','snapshot'] LOOP
  EXECUTE format('ALTER TABLE atlas_fx.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE atlas_fx.%I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('REVOKE ALL ON atlas_fx.%I FROM PUBLIC',tab);
  EXECUTE format('CREATE TRIGGER immutable_record BEFORE UPDATE OR DELETE ON atlas_fx.%I FOR EACH ROW EXECUTE FUNCTION atlas_fx.reject_mutation()',tab);
 END LOOP;
END $$;
DO $$ DECLARE exposed text; BEGIN
 FOREACH exposed IN ARRAY ARRAY['anon','authenticated','authenticator','service_role'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=exposed) THEN
   EXECUTE format('REVOKE ALL ON SCHEMA atlas_fx FROM %I',exposed);
   EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA atlas_fx FROM %I',exposed);
   EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA atlas_fx FROM %I',exposed);
  END IF;
 END LOOP;
END $$;
