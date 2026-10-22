ALTER TABLE atlas_history.schema_version DROP CONSTRAINT schema_version_version_check;
ALTER TABLE atlas_history.schema_version ADD CONSTRAINT schema_version_version_check CHECK(version IN (1,2,3));
CREATE TABLE atlas_history.writer_grant(role_name name PRIMARY KEY);
CREATE TABLE atlas_history.daily_source(
 id bytea PRIMARY KEY CHECK(octet_length(id)=32),
 coin_id integer NOT NULL REFERENCES atlas_market.coin(id),
 metric text NOT NULL CHECK(metric IN ('NETWORK_CIRCULATING','NETWORK_MINTED')),
 source_hash bytea NOT NULL CHECK(octet_length(source_hash)=32),
 window_from date NOT NULL,window_to date NOT NULL CHECK(window_to>=window_from AND window_to-window_from<=365),
 fetched_at timestamptz NOT NULL,
 coverage jsonb NOT NULL CHECK(jsonb_typeof(coverage)='array' AND jsonb_array_length(coverage) BETWEEN 1 AND 4 AND octet_length(coverage::text)<=32768),
 UNIQUE(coin_id,metric,source_hash,window_to),UNIQUE(id,coin_id,metric)
);
CREATE INDEX daily_source_latest ON atlas_history.daily_source(coin_id,metric,fetched_at DESC,id DESC);
CREATE TABLE atlas_history.daily_value(
 id bytea PRIMARY KEY CHECK(octet_length(id)=32),
 coin_id integer NOT NULL,metric text NOT NULL,network_id integer NOT NULL REFERENCES atlas_market.network(id),
 observed_day date NOT NULL,
 amount text NOT NULL CHECK(amount ~ '^(0|[1-9][0-9]{0,77})(\.[0-9]{1,36})?$'),
 first_source bytea NOT NULL,
 FOREIGN KEY(first_source,coin_id,metric) REFERENCES atlas_history.daily_source(id,coin_id,metric),
 UNIQUE(coin_id,metric,network_id,observed_day,id)
);
CREATE TABLE atlas_history.daily_latest(
 coin_id integer NOT NULL,metric text NOT NULL,network_id integer NOT NULL,observed_day date NOT NULL,
 value_id bytea NOT NULL,source_id bytea NOT NULL,
 PRIMARY KEY(coin_id,metric,network_id,observed_day),
 FOREIGN KEY(coin_id,metric,network_id,observed_day,value_id) REFERENCES atlas_history.daily_value(coin_id,metric,network_id,observed_day,id),
 FOREIGN KEY(source_id,coin_id,metric) REFERENCES atlas_history.daily_source(id,coin_id,metric)
);
CREATE TABLE atlas_history.scheduler_day(
 job text NOT NULL CHECK(job IN ('ARKHAM','DEFILLAMA')),day date NOT NULL,
 budget integer NOT NULL CHECK((job='ARKHAM' AND budget BETWEEN 1 AND 288) OR (job='DEFILLAMA' AND budget=1)),
 PRIMARY KEY(job,day)
);
CREATE TABLE atlas_history.scheduler_run(
 job text NOT NULL,slot timestamptz NOT NULL,
 day date GENERATED ALWAYS AS ((slot AT TIME ZONE 'UTC')::date) STORED,
 state text NOT NULL DEFAULT 'CLAIMED' CHECK(state IN ('CLAIMED','STORED','FAILED','UNCONFIRMED')),
 claimed_at timestamptz NOT NULL DEFAULT clock_timestamp(),finished_at timestamptz,
 error_code text CHECK(error_code ~ '^[A-Z_]{1,64}$'),
 PRIMARY KEY(job,slot),FOREIGN KEY(job,day) REFERENCES atlas_history.scheduler_day(job,day),
 CHECK((job='ARKHAM' AND extract(epoch FROM slot)=trunc(extract(epoch FROM slot)) AND extract(epoch FROM slot)::bigint%300=0) OR (job='DEFILLAMA' AND slot=date_trunc('day',slot AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'))
);
CREATE FUNCTION atlas_history.scheduler_transition() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE allowed integer; used integer;
BEGIN
 IF TG_OP='INSERT' THEN
  PERFORM pg_advisory_xact_lock(18471234,404);
  SELECT budget INTO allowed FROM atlas_history.scheduler_day WHERE job=NEW.job AND day=(NEW.slot AT TIME ZONE 'UTC')::date;
  SELECT count(*) INTO used FROM atlas_history.scheduler_run WHERE job=NEW.job AND day=(NEW.slot AT TIME ZONE 'UTC')::date;
  IF allowed IS NULL OR used>=allowed THEN RAISE EXCEPTION 'SCHEDULER_BUDGET_EXHAUSTED' USING ERRCODE='23514'; END IF;
  IF NEW.state<>'CLAIMED' OR NEW.finished_at IS NOT NULL OR NEW.error_code IS NOT NULL THEN RAISE EXCEPTION 'INVALID_SCHEDULER_TRANSITION' USING ERRCODE='23514'; END IF;
 ELSIF OLD.state<>'CLAIMED' OR NEW.state NOT IN ('STORED','FAILED','UNCONFIRMED') OR NEW.finished_at IS NULL OR
   NEW.job<>OLD.job OR NEW.slot<>OLD.slot OR NEW.claimed_at<>OLD.claimed_at THEN
  RAISE EXCEPTION 'INVALID_SCHEDULER_TRANSITION' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION atlas_history.scheduler_transition() FROM PUBLIC;
CREATE TRIGGER scheduler_transition BEFORE INSERT OR UPDATE ON atlas_history.scheduler_run FOR EACH ROW EXECUTE FUNCTION atlas_history.scheduler_transition();
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['writer_grant','daily_source','daily_value','daily_latest','scheduler_day','scheduler_run'] LOOP
  EXECUTE format('ALTER TABLE atlas_history.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE atlas_history.%I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('REVOKE ALL ON atlas_history.%I FROM PUBLIC',tab);
 END LOOP;
 FOREACH tab IN ARRAY ARRAY['writer_grant','daily_source','daily_value','scheduler_day'] LOOP
  EXECUTE format('CREATE TRIGGER immutable_record BEFORE UPDATE OR DELETE ON atlas_history.%I FOR EACH ROW EXECUTE FUNCTION atlas_history.reject_mutation()',tab);
 END LOOP;
END $$;
DO $$ DECLARE role_name text; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','authenticator','service_role'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA atlas_history FROM %I',role_name);
   EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA atlas_history FROM %I',role_name);
  END IF;
 END LOOP;
END $$;
