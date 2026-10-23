CREATE SCHEMA atlas_survey;
REVOKE ALL ON SCHEMA atlas_survey FROM PUBLIC;
CREATE TABLE atlas_survey.schema_version(version integer PRIMARY KEY CHECK(version=1),migration_hash bytea NOT NULL CHECK(octet_length(migration_hash)=32),structure_hash bytea NOT NULL CHECK(octet_length(structure_hash)=32));
CREATE TABLE atlas_survey.access_grant(role_name name PRIMARY KEY,access_mode text NOT NULL CHECK(access_mode IN ('reader','writer')));
CREATE TABLE atlas_survey.source(
 id bytea PRIMARY KEY CHECK(octet_length(id)=32),source_hash bytea NOT NULL CHECK(octet_length(source_hash)=32),
 mapper text NOT NULL CHECK(mapper='allium-stored-survey-v1'),kind text NOT NULL CHECK(kind IN ('supply','volume')),
 plan_hash bytea NOT NULL CHECK(octet_length(plan_hash)=32),review_hash bytea NOT NULL CHECK(octet_length(review_hash)=32),receipt_hash bytea NOT NULL CHECK(octet_length(receipt_hash)=32),
 queried_at timestamptz NOT NULL,imported_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 window_from date NOT NULL CHECK(window_from='2026-10-16'),window_to date NOT NULL CHECK(window_to='2026-10-22'),
 projection_hash bytea NOT NULL CHECK(octet_length(projection_hash)=32),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object' AND octet_length(payload::text)<=131072),
 CHECK(window_to<(queried_at AT TIME ZONE 'UTC')::date),
 UNIQUE(source_hash,mapper,kind,review_hash,receipt_hash),UNIQUE(kind,plan_hash,queried_at)
);
CREATE FUNCTION atlas_survey.reject_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN RAISE EXCEPTION 'IMMUTABLE_SURVEY_RECORD' USING ERRCODE='23514'; END $$;
REVOKE ALL ON FUNCTION atlas_survey.reject_mutation() FROM PUBLIC;
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['schema_version','access_grant','source'] LOOP
  EXECUTE format('ALTER TABLE atlas_survey.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE atlas_survey.%I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('REVOKE ALL ON atlas_survey.%I FROM PUBLIC',tab);
  EXECUTE format('CREATE TRIGGER immutable_record BEFORE UPDATE OR DELETE ON atlas_survey.%I FOR EACH ROW EXECUTE FUNCTION atlas_survey.reject_mutation()',tab);
 END LOOP;
END $$;
DO $$ DECLARE exposed text; BEGIN
 FOREACH exposed IN ARRAY ARRAY['anon','authenticated','authenticator','service_role'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=exposed) THEN
   EXECUTE format('REVOKE ALL ON SCHEMA atlas_survey FROM %I',exposed);
   EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA atlas_survey FROM %I',exposed);
   EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA atlas_survey FROM %I',exposed);
  END IF;
 END LOOP;
END $$;
