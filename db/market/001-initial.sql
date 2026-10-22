-- ADR0040 initial private market schema, PostgreSQL 17+. Applied only by explicit db:init.
CREATE SCHEMA atlas_market;
SET LOCAL search_path = atlas_market, pg_catalog;

-- Unconstrained numeric avoids typmod rounding before a CHECK can reject excess scale.
CREATE DOMAIN amount_decimal AS numeric
  CHECK (VALUE::text NOT IN ('NaN', 'Infinity', '-Infinity')
    AND VALUE >= 0 AND VALUE < 1e78::numeric AND scale(VALUE) <= 36);
CREATE DOMAIN sha256 AS bytea CHECK (octet_length(VALUE) = 32);
CREATE TYPE observation_state AS ENUM ('OBSERVED','MISSING','ERROR','UNSUPPORTED','NOT_TESTED');

CREATE TABLE coin (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE, symbol text NOT NULL, name text NOT NULL,
  retired_at timestamptz
);
CREATE TABLE network (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE, family text NOT NULL,
  network_identity text NOT NULL, retired_at timestamptz,
  UNIQUE (family, network_identity)
);
CREATE TABLE deployment (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE, coin_id integer NOT NULL REFERENCES coin,
  network_id integer NOT NULL REFERENCES network,
  identity_kind text NOT NULL CHECK (identity_kind IN ('CONTRACT','MINT','ISSUED')),
  -- Canonical identity: lower-case EVM only; case-sensitive TRON/Solana/XRPL.
  -- For ISSUED: canonical issuer + ':' + canonical currency. Preserve display spelling separately.
  identity_key text NOT NULL, identity_display jsonb NOT NULL,
  origin text NOT NULL DEFAULT 'UNKNOWN', retired_at timestamptz,
  UNIQUE (network_id, identity_kind, identity_key),
  UNIQUE (id, coin_id, network_id)
  -- Intentionally NO UNIQUE(coin_id, network_id): native/bridged/multiple contracts may coexist.
);
CREATE TABLE subject (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scope text NOT NULL CHECK (scope IN ('COIN','COIN_NETWORK','DEPLOYMENT','NETWORK')),
  coin_id integer REFERENCES coin, network_id integer REFERENCES network,
  deployment_id integer,
  CHECK ((scope='COIN' AND coin_id IS NOT NULL AND network_id IS NULL AND deployment_id IS NULL)
    OR (scope='COIN_NETWORK' AND coin_id IS NOT NULL AND network_id IS NOT NULL AND deployment_id IS NULL)
    OR (scope='DEPLOYMENT' AND coin_id IS NOT NULL AND network_id IS NOT NULL AND deployment_id IS NOT NULL)
    OR (scope='NETWORK' AND coin_id IS NULL AND network_id IS NOT NULL AND deployment_id IS NULL)),
  FOREIGN KEY (deployment_id, coin_id, network_id) REFERENCES deployment(id, coin_id, network_id),
  UNIQUE NULLS NOT DISTINCT (scope, coin_id, network_id, deployment_id),
  UNIQUE (id, scope)
);
CREATE TABLE provider (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE, name text NOT NULL
);
CREATE TABLE provider_identifier (
  provider_id integer NOT NULL REFERENCES provider,
  subject_id integer NOT NULL REFERENCES subject,
  namespace text NOT NULL, external_id text NOT NULL,
  PRIMARY KEY (provider_id, namespace, external_id)
);
CREATE TABLE metric_definition (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL, version integer NOT NULL CHECK (version > 0),
  scope text NOT NULL CHECK (scope IN ('COIN','COIN_NETWORK','DEPLOYMENT','NETWORK')),
  unit text NOT NULL, period_seconds integer CHECK (period_seconds > 0),
  semantic_state text NOT NULL CHECK (semantic_state IN ('DEFINED','UNCONFIRMED')),
  definition text NOT NULL, official_reference text,
  UNIQUE (code, version), UNIQUE (id, scope)
);
CREATE TABLE series (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subject_id integer NOT NULL, metric_id integer NOT NULL, scope text NOT NULL,
  provider_id integer NOT NULL REFERENCES provider,
  -- Reviewed public path only, never host/query/auth. Import preserves concrete endpoint.
  endpoint_path text NOT NULL CHECK (endpoint_path ~ '^/[A-Za-z0-9_/-]{1,180}$'),
  selector_suffix text NOT NULL,
  FOREIGN KEY (subject_id, scope) REFERENCES subject(id, scope),
  FOREIGN KEY (metric_id, scope) REFERENCES metric_definition(id, scope),
  UNIQUE (subject_id, metric_id, provider_id, endpoint_path, selector_suffix),
  UNIQUE (id, provider_id, endpoint_path)
);
CREATE TABLE request_definition (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider_id integer NOT NULL REFERENCES provider,
  endpoint_path text NOT NULL CHECK (endpoint_path ~ '^/[A-Za-z0-9_/-]{1,180}$'),
  version integer NOT NULL CHECK (version > 0),
  target_subject_id integer REFERENCES subject,
  request_kind text NOT NULL CHECK (request_kind IN ('HTTP_GET','XRPL_GATEWAY_BALANCES','IMPORTED_EVIDENCE')),
  -- Reviewed typed public target/parameters only; dynamic ledger hash lives on each request.
  request_shape jsonb NOT NULL CHECK (jsonb_typeof(request_shape)='object'),
  UNIQUE NULLS NOT DISTINCT (provider_id, endpoint_path, target_subject_id, version),
  UNIQUE (id, provider_id, endpoint_path)
);
-- Immutable request-definition versions snapshot the fields that were expected at that time.
CREATE TABLE request_series (
  request_definition_id integer NOT NULL,
  series_id integer NOT NULL,
  provider_id integer NOT NULL, endpoint_path text NOT NULL,
  PRIMARY KEY (request_definition_id, series_id),
  FOREIGN KEY (request_definition_id, provider_id, endpoint_path)
    REFERENCES request_definition(id, provider_id, endpoint_path),
  FOREIGN KEY (series_id, provider_id, endpoint_path)
    REFERENCES series(id, provider_id, endpoint_path)
);
-- Low-volume definition binding check, not a per-observation trigger.
CREATE FUNCTION check_request_series_target() RETURNS trigger LANGUAGE plpgsql SET search_path = atlas_market, pg_catalog AS $$
DECLARE t subject; s subject; d deployment; n network; q request_definition;
BEGIN
  SELECT * INTO STRICT q FROM request_definition WHERE id=NEW.request_definition_id;
  SELECT subject.* INTO STRICT s FROM subject JOIN series ON series.subject_id=subject.id WHERE series.id=NEW.series_id;
  SELECT * INTO STRICT t FROM subject WHERE id=q.target_subject_id;
  IF NOT ((t.scope='COIN' AND s.scope IN ('COIN','COIN_NETWORK') AND t.coin_id=s.coin_id)
      OR (t.scope IN ('COIN_NETWORK','DEPLOYMENT','NETWORK') AND t.id=s.id)) THEN
    RAISE EXCEPTION 'REQUEST_TARGET_MISMATCH' USING ERRCODE='23514';
  END IF;
  IF q.request_kind='XRPL_GATEWAY_BALANCES' THEN
    SELECT * INTO STRICT d FROM deployment WHERE id=t.deployment_id;
    SELECT * INTO STRICT n FROM network WHERE id=d.network_id;
    IF n.family<>'XRPL' OR (q.request_shape->'target'->>'issuer') IS DISTINCT FROM (d.identity_display->>'issuer')
      OR (q.request_shape->'target'->>'currency') IS DISTINCT FROM (d.identity_display->>'currency')
      OR (q.request_shape->'target'->>'network_identity') IS DISTINCT FROM n.network_identity THEN
      RAISE EXCEPTION 'XRPL_TARGET_MISMATCH' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER request_series_target BEFORE INSERT OR UPDATE ON request_series
  FOR EACH ROW EXECUTE FUNCTION check_request_series_target();

CREATE TABLE artifact (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  content_hash sha256 NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('LEGACY_REPORT','PROJECTION','RAW_RESPONSE','ROLLUP_MANIFEST','IMPORT_BINDING')),
  byte_length bigint NOT NULL CHECK (byte_length >= 0),
  -- Private storage-relative key; not a public/signed URL or an absolute local path.
  storage_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE collection_run (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  idempotency_key sha256 NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('MANUAL','IMPORT','SCHEDULED')),
  state text NOT NULL CHECK (state IN ('RUNNING','SUCCESS','PARTIAL','FAILED')),
  started_at timestamptz NOT NULL, finished_at timestamptz,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  CHECK (finished_at IS NULL OR finished_at >= started_at)
);
CREATE TABLE collection_request (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id bigint NOT NULL REFERENCES collection_run,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  definition_id integer NOT NULL REFERENCES request_definition,
  state text NOT NULL CHECK (state IN ('SUCCESS','PARTIAL','FAILED','NOT_ATTEMPTED','RECORDED')),
  evidence_kind text NOT NULL CHECK (evidence_kind IN ('HTTP_REQUEST','IMPORTED_REQUEST','IMPORTED_UNIT')),
  -- Original array location / explicit request identity, independent of legacy groupId.
  source_position text NOT NULL,
  observed_at timestamptz NOT NULL,
  observation_clock text NOT NULL CHECK (observation_clock IN ('REQUEST','REPORT_FALLBACK','SCHEDULE_ONLY')),
  artifact_id bigint REFERENCES artifact,
  selector_prefix text,
  -- These are bound to an actual fixed ledger, never inferred from ingestion time.
  ledger_hash bytea CHECK (ledger_hash IS NULL OR octet_length(ledger_hash)=32),
  ledger_index numeric CHECK (ledger_index IS NULL OR
    (ledger_index::text NOT IN ('NaN','Infinity','-Infinity') AND ledger_index>=0 AND scale(ledger_index)=0)),
  http_status smallint CHECK (http_status BETWEEN 100 AND 599),
  error_code text, retry_after_seconds integer CHECK (retry_after_seconds >= 0),
  UNIQUE (run_id, ordinal), UNIQUE (id, observed_at, definition_id),
  CHECK ((ledger_hash IS NULL) = (ledger_index IS NULL)),
  CHECK (state NOT IN ('SUCCESS','PARTIAL','RECORDED') OR
    (artifact_id IS NOT NULL AND selector_prefix IS NOT NULL AND observation_clock <> 'SCHEDULE_ONLY'))
);
-- Latest request/health lookup: measured separately from the lineage/PK indexes.
CREATE INDEX collection_request_latest ON collection_request(definition_id, observed_at DESC, id DESC);
CREATE TABLE observation (
  series_id integer NOT NULL,
  observed_at timestamptz NOT NULL,
  request_id bigint NOT NULL,
  request_definition_id integer NOT NULL,
  state observation_state NOT NULL,
  amount amount_decimal,
  source_at timestamptz,
  source_at_original text,
  CHECK(source_at_original IS NULL OR (source_at IS NOT NULL
    AND source_at_original ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{7,9}Z$'
    AND (substring(source_at_original FROM 1 FOR 26)||'Z')::timestamptz=source_at)),
  PRIMARY KEY (series_id, observed_at, request_id),
  FOREIGN KEY (request_id, observed_at, request_definition_id)
    REFERENCES collection_request(id, observed_at, definition_id),
  FOREIGN KEY (request_definition_id, series_id)
    REFERENCES request_series(request_definition_id, series_id),
  CHECK ((state='OBSERVED') = (amount IS NOT NULL))
) PARTITION BY RANGE (observed_at);
-- Implementation must provision UTC monthly partitions before insert; no catch-all partition.
-- The PK is also the bounded series/time chart index. Add indexes only after EXPLAIN/measurement.

-- Network status is typed separately from token amounts; tip is an integer string at the API edge.
CREATE TABLE request_network (
  request_definition_id integer NOT NULL REFERENCES request_definition,
  network_id integer NOT NULL REFERENCES network,
  PRIMARY KEY (request_definition_id, network_id)
);
CREATE TABLE network_observation (
  network_id integer NOT NULL,
  observed_at timestamptz NOT NULL, request_id bigint NOT NULL,
  request_definition_id integer NOT NULL,
  state observation_state NOT NULL,
  active boolean,
  tip numeric CHECK (tip IS NULL OR (tip::text NOT IN ('NaN','Infinity','-Infinity')
    AND tip >= 0 AND tip < 1e30::numeric AND scale(tip)=0)),
  source_at timestamptz,
  source_at_original text,
  CHECK(source_at_original IS NULL OR (source_at IS NOT NULL
    AND source_at_original ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{7,9}Z$'
    AND (substring(source_at_original FROM 1 FOR 26)||'Z')::timestamptz=source_at)),
  PRIMARY KEY (network_id, observed_at, request_id),
  FOREIGN KEY (request_id, observed_at, request_definition_id)
    REFERENCES collection_request(id, observed_at, definition_id),
  FOREIGN KEY (request_definition_id, network_id)
    REFERENCES request_network(request_definition_id, network_id),
  CHECK ((state='OBSERVED' AND active IS NOT NULL AND tip IS NOT NULL)
    OR (state<>'OBSERVED' AND active IS NULL AND tip IS NULL))
) PARTITION BY RANGE (observed_at);

-- Derived current value only; latest failed request is queried separately via request_series.
CREATE TABLE series_latest (
  series_id integer PRIMARY KEY REFERENCES series,
  observed_at timestamptz NOT NULL, request_id bigint NOT NULL,
  FOREIGN KEY (series_id, observed_at, request_id)
    REFERENCES observation(series_id, observed_at, request_id)
);
-- Import bridge is cold lineage, not a repeated 64-character identifier on every new sample.
CREATE TABLE legacy_observation (
  legacy_id sha256 PRIMARY KEY,
  legacy_group_id sha256 NOT NULL,
  original_selector text NOT NULL,
  legacy_deployment_id integer REFERENCES deployment,
  series_id integer NOT NULL, observed_at timestamptz NOT NULL, request_id bigint NOT NULL,
  FOREIGN KEY (series_id, observed_at, request_id)
    REFERENCES observation(series_id, observed_at, request_id)
);
CREATE TABLE series_rollup (
  series_id integer NOT NULL REFERENCES series,
  bucket_seconds integer NOT NULL CHECK (bucket_seconds IN (3600,86400)),
  bucket_start timestamptz NOT NULL,
  first_at timestamptz NOT NULL, last_at timestamptz NOT NULL,
  open_amount amount_decimal NOT NULL, high_amount amount_decimal NOT NULL,
  low_amount amount_decimal NOT NULL, close_amount amount_decimal NOT NULL,
  observed_count bigint NOT NULL CHECK (observed_count > 0),
  -- No inferred completeness: missing/error counts refer only to explicit field observations.
  missing_count bigint NOT NULL CHECK (missing_count >= 0),
  error_count bigint NOT NULL CHECK (error_count >= 0),
  unsupported_count bigint NOT NULL CHECK (unsupported_count >= 0),
  not_tested_count bigint NOT NULL CHECK (not_tested_count >= 0),
  definition_version integer NOT NULL CHECK (definition_version > 0),
  lineage_manifest_id bigint NOT NULL REFERENCES artifact,
  computed_at timestamptz NOT NULL,
  PRIMARY KEY (series_id, bucket_seconds, bucket_start),
  CHECK (bucket_start=date_bin(bucket_seconds * interval '1 second',bucket_start,timestamptz '2000-01-01 00:00:00+00')),
  CHECK (first_at >= bucket_start AND first_at <= last_at AND last_at < ((bucket_start AT TIME ZONE 'UTC' + make_interval(secs=>bucket_seconds)) AT TIME ZONE 'UTC')),
  CHECK (low_amount <= open_amount AND open_amount <= high_amount
    AND low_amount <= close_amount AND close_amount <= high_amount)
);
-- Server-only schema: no public/API grants. Explicit policy/roles remain implementation work.
-- ENABLE+FORCE protects new regular roles by default; owners/superusers still require careful use.
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='atlas_market' LOOP
    EXECUTE format('ALTER TABLE atlas_market.%I ENABLE ROW LEVEL SECURITY',r.tablename);
    EXECUTE format('ALTER TABLE atlas_market.%I FORCE ROW LEVEL SECURITY',r.tablename);
  END LOOP;
END $$;
REVOKE ALL ON SCHEMA atlas_market FROM PUBLIC;

CREATE TABLE schema_version (
  version integer PRIMARY KEY CHECK(version=1),
  migration_hash sha256 NOT NULL,
  structure_hash sha256 NOT NULL,
  installed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE access_grant (
  role_name name PRIMARY KEY,
  access_mode text NOT NULL CHECK(access_mode IN ('reader','writer'))
);
CREATE TABLE import_manifest (
  artifact_id bigint PRIMARY KEY REFERENCES artifact,
  run_id bigint NOT NULL UNIQUE REFERENCES collection_run,
  binding_artifact_id bigint NOT NULL REFERENCES artifact,
  mapper_version integer NOT NULL CHECK(mapper_version=1),
  plan_hash sha256 NOT NULL,
  observation_count integer NOT NULL CHECK(observation_count BETWEEN 0 AND 5000),
  network_count integer NOT NULL CHECK(network_count BETWEEN 0 AND 5000),
  unit_count integer NOT NULL CHECK(unit_count BETWEEN 1 AND 256)
);
CREATE FUNCTION reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'IMMUTABLE_MARKET_RECORD' USING ERRCODE='23514'; END $$;
CREATE FUNCTION freeze_request_membership() RETURNS trigger LANGUAGE plpgsql
SET search_path=atlas_market,pg_catalog AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM collection_request WHERE definition_id=NEW.request_definition_id) THEN
    RAISE EXCEPTION 'IMMUTABLE_REQUEST_MEMBERSHIP' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER freeze_series_membership BEFORE INSERT ON request_series
  FOR EACH ROW EXECUTE FUNCTION freeze_request_membership();
CREATE TRIGGER freeze_network_membership BEFORE INSERT ON request_network
  FOR EACH ROW EXECUTE FUNCTION freeze_request_membership();
CREATE FUNCTION guard_observation() RETURNS trigger LANGUAGE plpgsql
SET search_path=atlas_market,pg_catalog AS $$
DECLARE q collection_request; code text; target subject; d deployment; n network; shape jsonb;
BEGIN
  SELECT * INTO STRICT q FROM collection_request WHERE id=NEW.request_id;
  IF q.state NOT IN ('SUCCESS','PARTIAL','RECORDED') OR q.observation_clock='SCHEDULE_ONLY' THEN
    RAISE EXCEPTION 'REQUEST_NOT_OBSERVED' USING ERRCODE='23514';
  END IF;
  SELECT metric_definition.code INTO STRICT code FROM series JOIN metric_definition ON metric_definition.id=series.metric_id WHERE series.id=NEW.series_id;
  IF code='OBLIGATIONS' THEN
    SELECT subject.* INTO STRICT target FROM series JOIN subject ON subject.id=series.subject_id WHERE series.id=NEW.series_id;
    SELECT * INTO STRICT d FROM deployment WHERE id=target.deployment_id;
    SELECT * INTO STRICT n FROM network WHERE id=d.network_id;
    SELECT request_shape INTO STRICT shape FROM request_definition WHERE id=q.definition_id;
    IF n.family<>'XRPL' OR q.ledger_hash IS NULL OR q.ledger_index IS NULL
      OR (shape->'target'->>'issuer') IS DISTINCT FROM (d.identity_display->>'issuer')
      OR (shape->'target'->>'currency') IS DISTINCT FROM (d.identity_display->>'currency')
      OR (shape->'target'->>'network_identity') IS DISTINCT FROM n.network_identity THEN
      RAISE EXCEPTION 'XRPL_LEDGER_TARGET_REQUIRED' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER observation_request_guard BEFORE INSERT ON observation
  FOR EACH ROW EXECUTE FUNCTION guard_observation();
CREATE FUNCTION guard_network_observation() RETURNS trigger LANGUAGE plpgsql
SET search_path=atlas_market,pg_catalog AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM collection_request WHERE id=NEW.request_id AND state IN ('SUCCESS','PARTIAL','RECORDED') AND observation_clock<>'SCHEDULE_ONLY') THEN
    RAISE EXCEPTION 'REQUEST_NOT_OBSERVED' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER network_request_guard BEFORE INSERT ON network_observation
  FOR EACH ROW EXECUTE FUNCTION guard_network_observation();
CREATE FUNCTION guard_latest() RETURNS trigger LANGUAGE plpgsql
SET search_path=atlas_market,pg_catalog AS $$
BEGIN
  IF TG_OP='UPDATE' AND (NEW.series_id<>OLD.series_id OR (NEW.observed_at,NEW.request_id)<(OLD.observed_at,OLD.request_id)) THEN
    RAISE EXCEPTION 'LATEST_REGRESSION' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM observation WHERE series_id=NEW.series_id AND observed_at=NEW.observed_at AND request_id=NEW.request_id AND state='OBSERVED') THEN
    RAISE EXCEPTION 'LATEST_MUST_BE_OBSERVED' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER latest_success_guard BEFORE INSERT OR UPDATE ON series_latest
  FOR EACH ROW EXECUTE FUNCTION guard_latest();
DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['coin','network','deployment','subject','provider','provider_identifier','metric_definition','series','request_definition','request_series','request_network','artifact','collection_request','observation','network_observation','legacy_observation','import_manifest'] LOOP
    EXECUTE format('CREATE TRIGGER immutable_record BEFORE UPDATE OR DELETE ON atlas_market.%I FOR EACH ROW EXECUTE FUNCTION atlas_market.reject_mutation()',tab);
  END LOOP;
  FOREACH tab IN ARRAY ARRAY['schema_version','access_grant','import_manifest'] LOOP
    EXECUTE format('ALTER TABLE atlas_market.%I ENABLE ROW LEVEL SECURITY',tab);
    EXECUTE format('ALTER TABLE atlas_market.%I FORCE ROW LEVEL SECURITY',tab);
  END LOOP;
END $$;

CREATE FUNCTION guard_run_finish() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.state<>'RUNNING' OR NEW.state NOT IN ('SUCCESS','PARTIAL','FAILED') OR NEW.finished_at IS NULL
    OR NEW.id<>OLD.id OR NEW.idempotency_key<>OLD.idempotency_key OR NEW.kind<>OLD.kind
    OR NEW.started_at<>OLD.started_at OR NEW.ingested_at<>OLD.ingested_at THEN
    RAISE EXCEPTION 'INVALID_RUN_TRANSITION' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER run_finish_guard BEFORE UPDATE ON collection_run
  FOR EACH ROW EXECUTE FUNCTION guard_run_finish();
