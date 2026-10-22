CREATE SCHEMA atlas_history;
REVOKE ALL ON SCHEMA atlas_history FROM PUBLIC;
CREATE TABLE atlas_history.schema_version (
  version integer PRIMARY KEY CHECK(version=1),
  migration_hash bytea NOT NULL CHECK(octet_length(migration_hash)=32),
  structure_hash bytea NOT NULL CHECK(octet_length(structure_hash)=32)
);
CREATE TABLE atlas_history.reader_grant (role_name name PRIMARY KEY);
CREATE TABLE atlas_history.snapshot (
  coin_id integer NOT NULL REFERENCES atlas_market.coin(id),
  source_hash bytea NOT NULL CHECK(octet_length(source_hash)=32),
  window_to date NOT NULL,
  fetched_at timestamptz NOT NULL,
  projection jsonb NOT NULL CHECK(jsonb_typeof(projection)='object' AND octet_length(projection::text)<=524288),
  content_hash bytea NOT NULL CHECK(octet_length(content_hash)=32),
  PRIMARY KEY(coin_id,source_hash,window_to)
);
CREATE INDEX latest_snapshot ON atlas_history.snapshot(coin_id,fetched_at DESC,source_hash DESC,window_to DESC);
CREATE FUNCTION atlas_history.reject_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'IMMUTABLE_HISTORY_RECORD' USING ERRCODE='23514'; END $$;
REVOKE ALL ON FUNCTION atlas_history.reject_mutation() FROM PUBLIC;
DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['schema_version','reader_grant','snapshot'] LOOP
    EXECUTE format('ALTER TABLE atlas_history.%I ENABLE ROW LEVEL SECURITY',tab);
    EXECUTE format('ALTER TABLE atlas_history.%I FORCE ROW LEVEL SECURITY',tab);
    EXECUTE format('REVOKE ALL ON atlas_history.%I FROM PUBLIC',tab);
  END LOOP;
  CREATE TRIGGER immutable_record BEFORE UPDATE OR DELETE ON atlas_history.snapshot FOR EACH ROW EXECUTE FUNCTION atlas_history.reject_mutation();
  CREATE TRIGGER immutable_grant BEFORE UPDATE OR DELETE ON atlas_history.reader_grant FOR EACH ROW EXECUTE FUNCTION atlas_history.reject_mutation();
END $$;

-- Supabase projects may have default table grants; this private history has none.
DO $$ DECLARE role_name text; BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated','authenticator','service_role'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA atlas_history FROM %I',role_name);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA atlas_history FROM %I',role_name);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA atlas_history FROM %I',role_name);
    END IF;
  END LOOP;
END $$;
