-- Synthetic one-day sample, NOT live provider data. New disposable database only.
-- Run after candidate DDL + validation fixtures. All benchmark writes ROLLBACK.
-- No external requests or archive uploads. Artifact bytes are reproducible synthetic JSON;
-- only their metadata is stored here. Payload/object storage size is NOT measured.
SET search_path = atlas_market_design, pg_catalog;
SET timezone='UTC';
BEGIN;
CREATE TEMP TABLE bench_baseline AS SELECT
  (SELECT sum(pg_total_relation_size(c.oid)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='atlas_market_design' AND c.relkind='r') AS all_bytes,
  pg_total_relation_size('observation_2026_10') AS observation_bytes,
  pg_total_relation_size('collection_request') AS request_bytes,
  pg_total_relation_size('artifact') AS artifact_bytes;
CREATE TEMP TABLE bench_map AS
WITH c AS (
  INSERT INTO coin(code,symbol,name) SELECT 'bench-'||n,'B'||n,'Synthetic benchmark '||n
    FROM generate_series(1,30) n RETURNING id,code
), s AS (
  INSERT INTO subject(scope,coin_id) SELECT 'COIN',id FROM c RETURNING id,coin_id
) SELECT substring(c.code FROM 7)::integer AS coin_number,c.id AS coin_id,s.id AS subject_id
  FROM c JOIN s ON s.coin_id=c.id;
ALTER TABLE bench_map ADD COLUMN definition_id integer;
WITH d AS (
  INSERT INTO request_definition(provider_id,endpoint_path,version,target_subject_id,request_kind,request_shape)
    SELECT 1,'/synthetic/market/'||coin_number,1,subject_id,'HTTP_GET','{"fixture":true}'::jsonb
      FROM bench_map RETURNING id,target_subject_id
) UPDATE bench_map SET definition_id=d.id FROM d WHERE d.target_subject_id=bench_map.subject_id;
INSERT INTO series(subject_id,metric_id,scope,provider_id,endpoint_path,selector_suffix)
  SELECT b.subject_id,m.id,'COIN',1,'/synthetic/market/'||b.coin_number,'.data.'||lower(m.code)
    FROM bench_map b CROSS JOIN metric_definition m WHERE m.code IN ('PRICE','CIRCULATING','COIN_TOTAL');
INSERT INTO request_series(request_definition_id,series_id,provider_id,endpoint_path)
  SELECT b.definition_id,s.id,1,s.endpoint_path FROM bench_map b JOIN series s ON s.subject_id=b.subject_id;
CREATE TEMP TABLE bench_run AS WITH r AS (
  INSERT INTO collection_run(idempotency_key,kind,state,started_at,finished_at)
    VALUES(decode(repeat('66',32),'hex'),'IMPORT','SUCCESS','2026-10-22 00:00+00','2026-10-22 23:59+00') RETURNING id
) SELECT * FROM r;
CREATE TEMP TABLE bench_input AS SELECT b.coin_number,b.definition_id,minute,
  'synthetic/capacity/'||b.coin_number||'/'||minute AS storage_key,
  jsonb_build_object('kind','SYNTHETIC_CAPACITY_FIXTURE','coin',b.coin_number,'minute',minute)::text AS body
  FROM bench_map b CROSS JOIN generate_series(0,1439) minute;
INSERT INTO artifact(content_hash,kind,byte_length,storage_key)
  SELECT pg_catalog.sha256(convert_to(body,'UTF8')),'PROJECTION',octet_length(body),storage_key FROM bench_input;
CREATE TEMP TABLE bench_requests AS WITH r AS (
  INSERT INTO collection_request(run_id,ordinal,definition_id,state,observed_at,observation_clock,
    artifact_id,selector_prefix,evidence_kind,source_position)
  SELECT (SELECT id FROM bench_run),(b.coin_number-1)*1440+b.minute,b.definition_id,'SUCCESS',
    timestamptz '2026-10-22 00:00+00'+b.minute*interval '1 minute','REQUEST',a.id,'$','HTTP_REQUEST','$'
    FROM bench_input b JOIN artifact a USING(storage_key)
  RETURNING id,definition_id,observed_at
) SELECT * FROM r;
INSERT INTO observation(series_id,observed_at,request_id,request_definition_id,state,amount)
  SELECT s.id,r.observed_at,r.id,r.definition_id,'OBSERVED',
    CASE WHEN m.code='PRICE' THEN 1::numeric+b.coin_number/1000000::numeric+mod(extract(minute FROM r.observed_at)::integer,10)/1000000000::numeric
      ELSE 1000000000::numeric+b.coin_number*1000+extract(hour FROM r.observed_at) END
    FROM bench_requests r JOIN bench_map b ON b.definition_id=r.definition_id
      JOIN request_series rs ON rs.request_definition_id=r.definition_id
      JOIN series s ON s.id=rs.series_id JOIN metric_definition m ON m.id=s.metric_id;
INSERT INTO series_latest(series_id,observed_at,request_id)
  SELECT DISTINCT ON (o.series_id) o.series_id,o.observed_at,o.request_id FROM observation o
    JOIN bench_requests r ON o.request_id=r.id ORDER BY o.series_id,o.observed_at DESC,o.request_id DESC;
ANALYZE observation_2026_10;
ANALYZE collection_request;
ANALYZE series_latest;
\echo BOUNDED_CHART_EXPLAIN
EXPLAIN (ANALYZE,BUFFERS) SELECT observed_at,request_id,amount::text FROM observation
  WHERE series_id=(SELECT min(s.id) FROM series s JOIN bench_map b ON s.subject_id=b.subject_id)
    AND observed_at >= timestamptz '2026-10-22 00:00+00' AND observed_at < timestamptz '2026-10-23 00:00+00'
  ORDER BY observed_at,request_id LIMIT 1200;
-- Counterfactual in this disposable transaction; ROLLBACK restores the original index.
DROP INDEX collection_request_latest;
\echo REQUEST_HEALTH_WITHOUT_INDEX
EXPLAIN (ANALYZE,BUFFERS) SELECT id,state,observed_at FROM collection_request
  WHERE definition_id=(SELECT min(definition_id) FROM bench_map)
  ORDER BY observed_at DESC,id DESC LIMIT 1;
-- Dedicated health lookup index, unlike the request PK/lineage unique key.
CREATE INDEX collection_request_latest ON collection_request(definition_id,observed_at DESC,id DESC);
\echo REQUEST_HEALTH_WITH_INDEX
EXPLAIN (ANALYZE,BUFFERS) SELECT id,state,observed_at FROM collection_request
  WHERE definition_id=(SELECT min(definition_id) FROM bench_map)
  ORDER BY observed_at DESC,id DESC LIMIT 1;
\echo LATEST_VALUE_EXPLAIN
EXPLAIN (ANALYZE,BUFFERS) SELECT l.series_id,o.amount::text,o.observed_at FROM series_latest l
  JOIN observation o USING(series_id,observed_at,request_id)
  JOIN series s ON s.id=l.series_id JOIN bench_map b ON b.subject_id=s.subject_id
  WHERE l.observed_at >= timestamptz '2026-10-22 00:00+00' AND l.observed_at < timestamptz '2026-10-23 00:00+00';
SELECT jsonb_build_object('kind','SYNTHETIC_CAPACITY_RESULT_NOT_PRODUCTION_BENCHMARK',
  'engine',version(),'coins',30,'metrics_per_coin',3,'minutes',1440,
  'requests',(SELECT count(*) FROM bench_requests),'observations',129600,
  'observation_table_and_indexes_delta',pg_total_relation_size('observation_2026_10')-base.observation_bytes,
  'request_table_and_indexes_delta',pg_total_relation_size('collection_request')-base.request_bytes,
  'artifact_table_and_indexes_delta',pg_total_relation_size('artifact')-base.artifact_bytes,
  'all_schema_tables_and_indexes_delta',(SELECT sum(pg_total_relation_size(c.oid)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='atlas_market_design' AND c.relkind='r')-base.all_bytes,
  'average_observation_tuple_bytes',(SELECT round(avg(pg_column_size(o))) FROM observation o JOIN bench_requests r ON o.request_id=r.id)
) AS capacity_result FROM bench_baseline base;
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM observation o JOIN bench_requests r ON r.id=o.request_id)=129600;
  ASSERT (SELECT count(*) FROM bench_requests)=43200;
END $$;
ROLLBACK;
\echo DESIGN_CAPACITY_MEASUREMENT_PASS
