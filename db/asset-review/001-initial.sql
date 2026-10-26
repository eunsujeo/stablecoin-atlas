CREATE SCHEMA atlas_asset_review;
REVOKE ALL ON SCHEMA atlas_asset_review FROM PUBLIC;
CREATE TABLE atlas_asset_review.schema_version(version integer PRIMARY KEY CHECK(version=1),migration_hash bytea NOT NULL CHECK(octet_length(migration_hash)=32),structure_hash bytea NOT NULL CHECK(octet_length(structure_hash)=32));
CREATE TABLE atlas_asset_review.access_grant(role_name name PRIMARY KEY,access_mode text NOT NULL CHECK(access_mode IN ('reader','writer')));
CREATE TABLE atlas_asset_review.snapshot(
 snapshot_id text PRIMARY KEY CHECK(snapshot_id ~ '^[a-z0-9][a-z0-9-]{0,95}$'),
 reviewed_at date NOT NULL,
 profile_count integer NOT NULL CHECK(profile_count BETWEEN 1 AND 128),
 imported_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 payload_hash bytea NOT NULL CHECK(octet_length(payload_hash)=32),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object' AND octet_length(payload::text)<=262144),
 CHECK(payload ?& ARRAY['schemaVersion','kind','id','reviewedAt','notice','profiles']),
 CHECK(jsonb_typeof(payload->'id')='string' AND jsonb_typeof(payload->'reviewedAt')='string' AND jsonb_typeof(payload->'profiles')='array'),
 CHECK((payload->>'kind') IS NOT DISTINCT FROM 'REVIEWED_ASSET_PROFILES'),
 CHECK((payload->>'schemaVersion') IS NOT DISTINCT FROM '1'),
 CHECK(payload->>'id'=snapshot_id AND (payload->>'reviewedAt')::date=reviewed_at AND jsonb_array_length(payload->'profiles')=profile_count)
);
CREATE FUNCTION atlas_asset_review.reject_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN RAISE EXCEPTION 'IMMUTABLE_ASSET_REVIEW' USING ERRCODE='23514'; END $$;
REVOKE ALL ON FUNCTION atlas_asset_review.reject_mutation() FROM PUBLIC;
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['schema_version','access_grant','snapshot'] LOOP
  EXECUTE format('ALTER TABLE atlas_asset_review.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE atlas_asset_review.%I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('REVOKE ALL ON atlas_asset_review.%I FROM PUBLIC',tab);
  EXECUTE format('CREATE TRIGGER immutable_record BEFORE UPDATE OR DELETE ON atlas_asset_review.%I FOR EACH ROW EXECUTE FUNCTION atlas_asset_review.reject_mutation()',tab);
 END LOOP;
END $$;
DO $$ DECLARE exposed text; BEGIN
 FOREACH exposed IN ARRAY ARRAY['anon','authenticated','authenticator','service_role'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=exposed) THEN
   EXECUTE format('REVOKE ALL ON SCHEMA atlas_asset_review FROM %I',exposed);
   EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA atlas_asset_review FROM %I',exposed);
   EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA atlas_asset_review FROM %I',exposed);
  END IF;
 END LOOP;
END $$;
