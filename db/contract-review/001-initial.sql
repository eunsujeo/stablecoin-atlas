CREATE SCHEMA atlas_contract_review;
REVOKE ALL ON SCHEMA atlas_contract_review FROM PUBLIC;
CREATE TABLE atlas_contract_review.schema_version(version integer PRIMARY KEY CHECK(version=1),migration_hash bytea NOT NULL CHECK(octet_length(migration_hash)=32),structure_hash bytea NOT NULL CHECK(octet_length(structure_hash)=32));
CREATE TABLE atlas_contract_review.access_grant(role_name name PRIMARY KEY,access_mode text NOT NULL CHECK(access_mode IN ('reader','writer')));
CREATE TABLE atlas_contract_review.report(
 report_id text PRIMARY KEY CHECK(report_id ~ '^[a-z0-9-]{1,96}$'),
 chain_id text NOT NULL CHECK(chain_id ~ '^[1-9][0-9]{0,30}$'),
 address text NOT NULL CHECK(address ~ '^0x[0-9a-f]{40}$'),
 observed_at timestamptz NOT NULL,
 imported_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 payload_hash bytea NOT NULL CHECK(octet_length(payload_hash)=32),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object' AND octet_length(payload::text)<=65536),
 CHECK(payload ?& ARRAY['id','name','network','chainId','address','status','reviewedAt','observedAt','analysisDate','purpose','source','sections']),
 CHECK(jsonb_typeof(payload->'id')='string' AND jsonb_typeof(payload->'chainId')='string' AND jsonb_typeof(payload->'address')='string' AND jsonb_typeof(payload->'observedAt')='string' AND (payload->>'status') IS NOT DISTINCT FROM 'UNKNOWN'),
 CHECK(payload->>'id'=report_id AND payload->>'chainId'=chain_id AND payload->>'address'=address AND (payload->>'observedAt')::timestamptz=observed_at)
);
CREATE FUNCTION atlas_contract_review.reject_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN RAISE EXCEPTION 'IMMUTABLE_CONTRACT_REVIEW' USING ERRCODE='23514'; END $$;
REVOKE ALL ON FUNCTION atlas_contract_review.reject_mutation() FROM PUBLIC;
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['schema_version','access_grant','report'] LOOP
  EXECUTE format('ALTER TABLE atlas_contract_review.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE atlas_contract_review.%I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('REVOKE ALL ON atlas_contract_review.%I FROM PUBLIC',tab);
  EXECUTE format('CREATE TRIGGER immutable_record BEFORE UPDATE OR DELETE ON atlas_contract_review.%I FOR EACH ROW EXECUTE FUNCTION atlas_contract_review.reject_mutation()',tab);
 END LOOP;
END $$;
DO $$ DECLARE exposed text; BEGIN
 FOREACH exposed IN ARRAY ARRAY['anon','authenticated','authenticator','service_role'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=exposed) THEN
   EXECUTE format('REVOKE ALL ON SCHEMA atlas_contract_review FROM %I',exposed);
   EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA atlas_contract_review FROM %I',exposed);
   EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA atlas_contract_review FROM %I',exposed);
  END IF;
 END LOOP;
END $$;
