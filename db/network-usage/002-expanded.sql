CREATE TABLE atlas_network_usage.upgrade_version(version integer PRIMARY KEY CHECK(version=2),migration_hash bytea NOT NULL CHECK(octet_length(migration_hash)=32),structure_hash bytea NOT NULL CHECK(octet_length(structure_hash)=32));
CREATE TABLE atlas_network_usage.snapshot_v2(
 snapshot_id text PRIMARY KEY CHECK(snapshot_id ~ '^arkham-usage-v2-[a-f0-9]{64}$'),
 window_end date NOT NULL, queried_at timestamptz NOT NULL,
 row_count integer NOT NULL CHECK(row_count=126),
 imported_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 payload_hash bytea NOT NULL CHECK(octet_length(payload_hash)=32),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object' AND octet_length(payload::text)<=262144),
 CHECK(payload ?& ARRAY['schemaVersion','kind','id','provider','window','rows','sourceReceipts','availability']),
 CHECK((payload->>'kind') IS NOT DISTINCT FROM 'ARKHAM_NETWORK_USAGE' AND (payload->>'schemaVersion') IS NOT DISTINCT FROM '2'),
 CHECK(jsonb_typeof(payload->'id')='string' AND jsonb_typeof(payload->'window')='object'),
 CHECK(jsonb_typeof(payload->'rows')='array' AND jsonb_typeof(payload->'availability')='array' AND jsonb_array_length(payload->'availability')=33),
 CHECK(jsonb_path_exists(payload,'$.rows[*] ? (@.state == "OBSERVED")')),
 CHECK(payload->>'id'=snapshot_id AND (payload->'window'->>'untilExclusive')::date=window_end AND jsonb_array_length(payload->'rows')=row_count)
);
CREATE TABLE atlas_network_usage.collection_day(
 day date PRIMARY KEY, plan_hash bytea NOT NULL CHECK(octet_length(plan_hash)=32),
 owner_id uuid NOT NULL, claimed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['upgrade_version','snapshot_v2','collection_day'] LOOP
  EXECUTE format('ALTER TABLE atlas_network_usage.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE atlas_network_usage.%I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('REVOKE ALL ON atlas_network_usage.%I FROM PUBLIC',tab);
  EXECUTE format('CREATE TRIGGER immutable_record BEFORE UPDATE OR DELETE ON atlas_network_usage.%I FOR EACH ROW EXECUTE FUNCTION atlas_network_usage.reject_mutation()',tab);
 END LOOP;
END $$;
