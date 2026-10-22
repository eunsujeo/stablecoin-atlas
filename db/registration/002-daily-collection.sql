ALTER TABLE atlas_registration.schema_version DROP CONSTRAINT schema_version_version_check;
ALTER TABLE atlas_registration.schema_version ADD CHECK(version IN (1,2));
CREATE TABLE atlas_registration.writer_grant(role_name name PRIMARY KEY);
CREATE TABLE atlas_registration.collection_run(
 day date NOT NULL DEFAULT (clock_timestamp() AT TIME ZONE 'UTC')::date,
 coin text NOT NULL CHECK(coin IN ('usdt','usdc','rlusd','jpyc','jpysc')),
 selection_id bytea NOT NULL REFERENCES atlas_registration.selection(id),
 claimed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(day,coin), UNIQUE(day,coin,selection_id),
 CHECK(day=(claimed_at AT TIME ZONE 'UTC')::date)
);
CREATE TABLE atlas_registration.collection_result(
 day date NOT NULL,coin text NOT NULL,selection_id bytea NOT NULL,
 state text NOT NULL CHECK(state IN ('STORED','FAILED','UNCONFIRMED')),
 error_code text CHECK(error_code ~ '^[A-Z_]{1,64}$'),
 finished_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(day,coin),
 FOREIGN KEY(day,coin,selection_id) REFERENCES atlas_registration.collection_run(day,coin,selection_id),
 CHECK((state='STORED')=(error_code IS NULL))
);
DO $$ DECLARE tab text; exposed text; BEGIN
 FOREACH tab IN ARRAY ARRAY['writer_grant','collection_run','collection_result'] LOOP
  EXECUTE format('ALTER TABLE atlas_registration.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE atlas_registration.%I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('REVOKE ALL ON atlas_registration.%I FROM PUBLIC',tab);
  EXECUTE format('CREATE TRIGGER immutable_record BEFORE UPDATE OR DELETE ON atlas_registration.%I FOR EACH ROW EXECUTE FUNCTION atlas_registration.reject_mutation()',tab);
  FOREACH exposed IN ARRAY ARRAY['anon','authenticated','authenticator','service_role'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=exposed) THEN
    EXECUTE format('REVOKE ALL ON atlas_registration.%I FROM %I',tab,exposed);
   END IF;
  END LOOP;
 END LOOP;
END $$;
