CREATE SCHEMA atlas_registration;
REVOKE ALL ON SCHEMA atlas_registration FROM PUBLIC;
CREATE TABLE atlas_registration.schema_version(
 version integer PRIMARY KEY CHECK(version=1),
 migration_hash bytea NOT NULL CHECK(octet_length(migration_hash)=32),
 structure_hash bytea NOT NULL CHECK(octet_length(structure_hash)=32)
);
CREATE TABLE atlas_registration.reader_grant(role_name name PRIMARY KEY);
CREATE TABLE atlas_registration.metadata_revision(
 id bytea PRIMARY KEY CHECK(octet_length(id)=32),revision integer NOT NULL UNIQUE CHECK(revision>0),
 legacy_hash bytea NOT NULL CHECK(octet_length(legacy_hash)=32),
 document jsonb NOT NULL CHECK(jsonb_typeof(document)='object' AND octet_length(document::text)<=262144),
 legacy_document jsonb NOT NULL CHECK(jsonb_typeof(legacy_document)='object' AND octet_length(legacy_document::text)<=131072),
 contracts jsonb NOT NULL CHECK(jsonb_typeof(contracts)='object')
);
CREATE TABLE atlas_registration.selection(
 id bytea PRIMARY KEY CHECK(octet_length(id)=32),metadata_id bytea NOT NULL REFERENCES atlas_registration.metadata_revision(id),
 source_hash bytea NOT NULL CHECK(octet_length(source_hash)=32),fetched_at timestamptz NOT NULL,
 selection_day date GENERATED ALWAYS AS ((fetched_at AT TIME ZONE 'UTC')::date) STORED,
 document jsonb NOT NULL CHECK(jsonb_typeof(document)='object' AND octet_length(document::text)<=524288),
 UNIQUE(metadata_id,source_hash,selection_day),UNIQUE(id,metadata_id)
);
CREATE TABLE atlas_registration.coverage(
 id bytea PRIMARY KEY CHECK(octet_length(id)=32),
 payload bytea NOT NULL CHECK(octet_length(payload) BETWEEN 1 AND 1048576)
);
CREATE TABLE atlas_registration.daily_value(
 id bytea PRIMARY KEY CHECK(octet_length(id)=32),metadata_id bytea NOT NULL REFERENCES atlas_registration.metadata_revision(id),
 coin text NOT NULL CHECK(coin ~ '^[a-z][a-z0-9-]{0,63}$'),
 metric text NOT NULL CHECK(metric IN ('NETWORK_CIRCULATING','NETWORK_MINTED')),
 network text NOT NULL CHECK(network ~ '^[a-z][a-z0-9-]{0,63}$'),observed_day date NOT NULL,
 amount text NOT NULL CHECK(amount ~ '^(0|[1-9][0-9]{0,77})(\.[0-9]{1,36})?$')
);
CREATE TABLE atlas_registration.daily_source(
 id bytea PRIMARY KEY CHECK(octet_length(id)=32),selection_id bytea NOT NULL,metadata_id bytea NOT NULL,
 coin text NOT NULL CHECK(coin ~ '^[a-z][a-z0-9-]{0,63}$'),
 metric text NOT NULL CHECK(metric IN ('NETWORK_CIRCULATING','NETWORK_MINTED')),
 source_hash bytea NOT NULL CHECK(octet_length(source_hash)=32),
 window_from date NOT NULL,window_to date NOT NULL CHECK(window_to>=window_from AND window_to-window_from<=365),
 fetched_at timestamptz NOT NULL,coverage_id bytea NOT NULL REFERENCES atlas_registration.coverage(id),
 FOREIGN KEY(selection_id,metadata_id) REFERENCES atlas_registration.selection(id,metadata_id),
 UNIQUE(selection_id,coin,metric,source_hash,window_to)
);
CREATE INDEX daily_source_lookup ON atlas_registration.daily_source(selection_id,coin,metric,fetched_at DESC,id DESC);
CREATE FUNCTION atlas_registration.reject_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'IMMUTABLE_REGISTRATION_RECORD' USING ERRCODE='23514'; END $$;
REVOKE ALL ON FUNCTION atlas_registration.reject_mutation() FROM PUBLIC;
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['schema_version','reader_grant','metadata_revision','selection','coverage','daily_value','daily_source'] LOOP
  EXECUTE format('ALTER TABLE atlas_registration.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE atlas_registration.%I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('REVOKE ALL ON atlas_registration.%I FROM PUBLIC',tab);
  EXECUTE format('CREATE TRIGGER immutable_record BEFORE UPDATE OR DELETE ON atlas_registration.%I FOR EACH ROW EXECUTE FUNCTION atlas_registration.reject_mutation()',tab);
 END LOOP;
END $$;
DO $$ DECLARE role_name text; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','authenticator','service_role'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON SCHEMA atlas_registration FROM %I',role_name);
   EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA atlas_registration FROM %I',role_name);
   EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA atlas_registration FROM %I',role_name);
  END IF;
 END LOOP;
END $$;
