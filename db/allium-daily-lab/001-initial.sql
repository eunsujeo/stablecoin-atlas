CREATE SCHEMA atlas_allium_daily_lab;
REVOKE ALL ON SCHEMA atlas_allium_daily_lab FROM PUBLIC;
CREATE TABLE atlas_allium_daily_lab.configuration(
 version integer PRIMARY KEY CHECK(version=1),fixture_hash text NOT NULL CHECK(fixture_hash ~ '^[a-f0-9]{64}$'),
 writer_name name NOT NULL,reader_name name NOT NULL,migration_hash text NOT NULL,structure_hash text NOT NULL
);
CREATE TABLE atlas_allium_daily_lab.entry(
 organization_hash text NOT NULL CHECK(organization_hash ~ '^[a-f0-9]{64}$'),
 ordinal integer NOT NULL CHECK(ordinal BETWEEN 1 AND 8192),
 previous_hash text NOT NULL CHECK(previous_hash ~ '^[a-f0-9]{64}$'),
 event_hash text NOT NULL CHECK(event_hash ~ '^[a-f0-9]{64}$'),
 payload text NOT NULL CHECK(octet_length(payload)<=3145728 AND jsonb_typeof(payload::jsonb)='object'),
 PRIMARY KEY(organization_hash,ordinal),UNIQUE(organization_hash,event_hash),
 CHECK(payload::jsonb->>'organizationHash'=organization_hash)
);
CREATE UNIQUE INDEX one_usage_per_day ON atlas_allium_daily_lab.entry(organization_hash,(left(payload::jsonb->>'at',10))) WHERE payload::jsonb->>'type'='USAGE_INTENT';
CREATE UNIQUE INDEX one_reservation_slot ON atlas_allium_daily_lab.entry(organization_hash,(payload::jsonb->>'id')) WHERE payload::jsonb->>'type'='RESERVE';
CREATE FUNCTION atlas_allium_daily_lab.reject_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
 BEGIN RAISE EXCEPTION 'IMMUTABLE_DAILY_LAB_RECORD' USING ERRCODE='23514'; END $$;
CREATE FUNCTION atlas_allium_daily_lab.guard_chain() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
 DECLARE n integer; previous text;
 BEGIN
 PERFORM pg_advisory_xact_lock(18471236,hashtext(NEW.organization_hash));
 SELECT ordinal,event_hash INTO n,previous FROM atlas_allium_daily_lab.entry WHERE organization_hash=NEW.organization_hash ORDER BY ordinal DESC LIMIT 1;
 IF NEW.ordinal<>coalesce(n,0)+1 OR NEW.previous_hash<>coalesce(previous,repeat('0',64)) OR
 NEW.event_hash<>encode(sha256(convert_to(NEW.organization_hash||E'\n'||NEW.ordinal::text||E'\n'||NEW.previous_hash||E'\n'||encode(sha256(convert_to(NEW.payload,'UTF8')),'hex'),'UTF8')),'hex') THEN
 RAISE EXCEPTION 'DAILY_LAB_CHAIN_INVALID' USING ERRCODE='23514'; END IF;
 RETURN NEW;
 END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA atlas_allium_daily_lab FROM PUBLIC;
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['configuration','entry'] LOOP
 EXECUTE format('ALTER TABLE atlas_allium_daily_lab.%I ENABLE ROW LEVEL SECURITY',tab);
 EXECUTE format('ALTER TABLE atlas_allium_daily_lab.%I FORCE ROW LEVEL SECURITY',tab);
 EXECUTE format('REVOKE ALL ON atlas_allium_daily_lab.%I FROM PUBLIC',tab);
 EXECUTE format('CREATE TRIGGER immutable_record BEFORE UPDATE OR DELETE OR TRUNCATE ON atlas_allium_daily_lab.%I FOR EACH STATEMENT EXECUTE FUNCTION atlas_allium_daily_lab.reject_mutation()',tab);
 END LOOP;
END $$;
CREATE TRIGGER validate_chain BEFORE INSERT ON atlas_allium_daily_lab.entry FOR EACH ROW EXECUTE FUNCTION atlas_allium_daily_lab.guard_chain();
