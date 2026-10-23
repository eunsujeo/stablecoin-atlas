ALTER TABLE atlas_registration.schema_version DROP CONSTRAINT schema_version_version_check;
ALTER TABLE atlas_registration.schema_version ADD CHECK(version IN (1,2,3));
CREATE TABLE atlas_registration.coin_market_source(
 id bytea PRIMARY KEY CHECK(octet_length(id)=32),
 selection_id bytea NOT NULL,metadata_id bytea NOT NULL,
 coin text NOT NULL CHECK(coin IN ('usdt','usdc','rlusd','jpyc','jpysc')),
 source_hash bytea NOT NULL CHECK(octet_length(source_hash)=32),
 request_day date NOT NULL,fetched_at timestamptz NOT NULL,
 projection jsonb NOT NULL CHECK(jsonb_typeof(projection)='object' AND octet_length(projection::text)<=16384),
 FOREIGN KEY(selection_id,metadata_id) REFERENCES atlas_registration.selection(id,metadata_id),
 UNIQUE(selection_id,coin,source_hash,request_day),
 CHECK(fetched_at>=request_day::timestamp AT TIME ZONE 'UTC' AND fetched_at<((request_day+1)::timestamp AT TIME ZONE 'UTC')+interval '60 seconds')
);
CREATE INDEX coin_market_source_latest ON atlas_registration.coin_market_source(selection_id,coin,fetched_at DESC,id DESC);
ALTER TABLE atlas_registration.coin_market_source ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas_registration.coin_market_source FORCE ROW LEVEL SECURITY;
REVOKE ALL ON atlas_registration.coin_market_source FROM PUBLIC;
CREATE TRIGGER immutable_record BEFORE UPDATE OR DELETE ON atlas_registration.coin_market_source FOR EACH ROW EXECUTE FUNCTION atlas_registration.reject_mutation();
DO $$ DECLARE exposed text; BEGIN
 FOREACH exposed IN ARRAY ARRAY['anon','authenticated','authenticator','service_role'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=exposed) THEN EXECUTE format('REVOKE ALL ON atlas_registration.coin_market_source FROM %I',exposed); END IF;
 END LOOP;
END $$;
