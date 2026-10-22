CREATE SCHEMA atlas_catalog;
REVOKE ALL ON SCHEMA atlas_catalog FROM PUBLIC;
CREATE TABLE atlas_catalog.schema_version (
  version integer PRIMARY KEY CHECK(version=1),
  migration_hash bytea NOT NULL CHECK(octet_length(migration_hash)=32),
  structure_hash bytea NOT NULL CHECK(octet_length(structure_hash)=32)
);
CREATE TABLE atlas_catalog.reader_grant (role_name name PRIMARY KEY);
CREATE TABLE atlas_catalog.token_profile (
  deployment_id integer NOT NULL REFERENCES atlas_market.deployment(id),
  revision integer NOT NULL CHECK(revision>0),
  standard text NOT NULL CHECK(standard IN ('ERC-20','TRC-20','SPL Token','XRPL Issued Token')),
  asset_description text NOT NULL CHECK(length(asset_description) BETWEEN 1 AND 300),
  network_description text NOT NULL CHECK(length(network_description) BETWEEN 1 AND 400),
  identity_snapshot jsonb NOT NULL CHECK(jsonb_typeof(identity_snapshot)='object'),
  sources jsonb NOT NULL CHECK(jsonb_typeof(sources)='array' AND jsonb_array_length(sources) BETWEEN 1 AND 6),
  reviewed_at timestamptz NOT NULL,
  content_hash bytea NOT NULL CHECK(octet_length(content_hash)=32),
  PRIMARY KEY(deployment_id,revision)
);
CREATE FUNCTION atlas_catalog.reject_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'IMMUTABLE_CATALOG_RECORD' USING ERRCODE='23514'; END $$;
REVOKE ALL ON FUNCTION atlas_catalog.reject_mutation() FROM PUBLIC;
DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['schema_version','reader_grant','token_profile'] LOOP
    EXECUTE format('ALTER TABLE atlas_catalog.%I ENABLE ROW LEVEL SECURITY',tab);
    EXECUTE format('ALTER TABLE atlas_catalog.%I FORCE ROW LEVEL SECURITY',tab);
    EXECUTE format('REVOKE ALL ON atlas_catalog.%I FROM PUBLIC',tab);
  END LOOP;
  CREATE TRIGGER immutable_record BEFORE UPDATE OR DELETE ON atlas_catalog.token_profile FOR EACH ROW EXECUTE FUNCTION atlas_catalog.reject_mutation();
  CREATE TRIGGER immutable_grant BEFORE UPDATE OR DELETE ON atlas_catalog.reader_grant FOR EACH ROW EXECUTE FUNCTION atlas_catalog.reject_mutation();
END $$;

-- Supabase projects may have default table grants; this private catalog has none.
DO $$ DECLARE role_name text; BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated','authenticator','service_role'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA atlas_catalog FROM %I',role_name);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA atlas_catalog FROM %I',role_name);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA atlas_catalog FROM %I',role_name);
    END IF;
  END LOOP;
END $$;
