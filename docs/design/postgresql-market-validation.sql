-- Synthetic local design fixtures only. Run AFTER candidate DDL in a NEW disposable DB.
-- Not a production migration, importer, remote test or proof of writer correctness.
SET search_path = atlas_market_design, pg_catalog;
SET timezone = 'UTC';
CREATE TABLE observation_2026_10 PARTITION OF observation
  FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');
CREATE TABLE network_observation_2026_10 PARTITION OF network_observation
  FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');
ALTER TABLE observation_2026_10 ENABLE ROW LEVEL SECURITY;
ALTER TABLE observation_2026_10 FORCE ROW LEVEL SECURITY;
ALTER TABLE network_observation_2026_10 ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_observation_2026_10 FORCE ROW LEVEL SECURITY;
CREATE FUNCTION assert_rejected(statement text, expected_code text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE caught_code text;
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS caught_code = RETURNED_SQLSTATE;
  END;
  IF caught_code IS DISTINCT FROM expected_code THEN
    RAISE EXCEPTION 'Expected SQLSTATE %, got % for %', expected_code, caught_code, statement;
  END IF;
END $$;
INSERT INTO coin(code,symbol,name) VALUES ('fixture-a','F1','Synthetic one'),('fixture-b','F2','Synthetic two');
INSERT INTO network(code,family,network_identity) VALUES ('fixture-evm','EVM','fixture-genesis-1');
INSERT INTO deployment(code,coin_id,network_id,identity_kind,identity_key,identity_display)
  VALUES ('fixture-native',1,1,'CONTRACT','fixture-native','{"address":"fixture-native"}'),
         ('fixture-bridged',1,1,'CONTRACT','fixture-bridged','{"address":"fixture-bridged"}');
INSERT INTO subject(scope,coin_id,network_id,deployment_id) VALUES
  ('COIN',1,NULL,NULL),('COIN_NETWORK',1,1,NULL),('DEPLOYMENT',1,1,1),('NETWORK',NULL,1,NULL);
SELECT assert_rejected($q$INSERT INTO subject(scope,coin_id,network_id) VALUES ('COIN',1,1)$q$,'23514');
SELECT assert_rejected($q$INSERT INTO subject(scope,coin_id) VALUES ('COIN',1)$q$,'23505');
SELECT assert_rejected($q$INSERT INTO subject(scope,coin_id,network_id,deployment_id) VALUES ('DEPLOYMENT',2,1,1)$q$,'23503');
INSERT INTO provider(code,name) VALUES ('fixture','Synthetic provider'),('other','Other synthetic provider');
INSERT INTO metric_definition(code,version,scope,unit,semantic_state,definition) VALUES
  ('PRICE',1,'COIN','USD','DEFINED','Synthetic price'),
  ('CIRCULATING',1,'COIN','token','DEFINED','Synthetic circulating'),
  ('CHAIN_TOTAL',1,'COIN_NETWORK','token','DEFINED','Synthetic provider chain aggregate'),
  ('COIN_TOTAL',1,'COIN','token','DEFINED','Synthetic total'),
  ('REPORTED_VOLUME',1,'COIN','UNKNOWN','UNCONFIRMED','Period/unit unconfirmed');
INSERT INTO series(subject_id,metric_id,scope,provider_id,endpoint_path,selector_suffix) VALUES
  (1,1,'COIN',1,'/fixture/market/a','.data.price'),
  (1,2,'COIN',1,'/fixture/market/a','.data.circulatingSupply'),
  (2,3,'COIN_NETWORK',1,'/fixture/holders/a','.data.totalSupply.fixture'),
  (1,1,'COIN',2,'/fixture/market/a','.data.price');
SELECT assert_rejected($q$INSERT INTO series(subject_id,metric_id,scope,provider_id,endpoint_path,selector_suffix)
  VALUES (1,3,'COIN',1,'/fixture/market/a','.bad')$q$,'23503');
INSERT INTO request_definition(provider_id,endpoint_path,version,target_subject_id,request_kind,request_shape) VALUES
  (1,'/fixture/market/a',1,1,'HTTP_GET','{}'),(1,'/fixture/holders/a',1,1,'HTTP_GET','{}'),
  (2,'/fixture/market/a',1,1,'HTTP_GET','{}'),(1,'/fixture/networks',1,NULL,'HTTP_GET','{}');
INSERT INTO request_series(request_definition_id,series_id,provider_id,endpoint_path) VALUES
  (1,1,1,'/fixture/market/a'),(1,2,1,'/fixture/market/a'),(2,3,1,'/fixture/holders/a'),(3,4,2,'/fixture/market/a');
INSERT INTO request_network VALUES (4,1);
SELECT assert_rejected($q$INSERT INTO request_series VALUES (1,4,1,'/fixture/market/a')$q$,'23503');
SELECT assert_rejected($q$INSERT INTO request_series VALUES (2,1,1,'/fixture/holders/a')$q$,'23503');
INSERT INTO artifact(content_hash,kind,byte_length,storage_key)
  VALUES (decode(repeat('11',32),'hex'),'PROJECTION',2,'synthetic/fixture.json'),
         (decode(repeat('33',32),'hex'),'ROLLUP_MANIFEST',2,'synthetic/manifest.json');
INSERT INTO collection_run(idempotency_key,kind,state,started_at,finished_at) VALUES
  (decode(repeat('22',32),'hex'),'IMPORT','SUCCESS','2026-10-21 00:00+00','2026-10-21 00:04+00');
SELECT assert_rejected($q$INSERT INTO collection_run(idempotency_key,kind,state,started_at)
  VALUES (decode(repeat('22',32),'hex'),'IMPORT','RUNNING',now())$q$,'23505');
INSERT INTO collection_request(run_id,ordinal,definition_id,state,observed_at,observation_clock,artifact_id,selector_prefix,evidence_kind,source_position) VALUES
  (1,0,1,'SUCCESS','2026-10-21 00:00+00','REQUEST',1,'$.requests[0]','IMPORTED_REQUEST','$.requests[0]'),
  (1,1,2,'SUCCESS','2026-10-21 00:00+00','REPORT_FALLBACK',1,'$.requests[1]','IMPORTED_REQUEST','$.requests[1]'),
  (1,2,1,'SUCCESS','2026-10-21 00:01+00','REQUEST',1,'$.requests[0]','IMPORTED_REQUEST','$.requests[0]'),
  (1,3,1,'FAILED','2026-10-21 00:02+00','REQUEST',NULL,NULL,'HTTP_REQUEST','$'),
  (1,4,1,'NOT_ATTEMPTED','2026-10-21 00:03+00','SCHEDULE_ONLY',NULL,NULL,'HTTP_REQUEST','$'),
  (1,5,4,'SUCCESS','2026-10-21 00:00+00','REQUEST',1,'$.requests[5]','IMPORTED_REQUEST','$.requests[5]');
SELECT assert_rejected($q$INSERT INTO collection_request(run_id,ordinal,definition_id,state,observed_at,observation_clock,artifact_id,selector_prefix,ledger_hash,evidence_kind,source_position)
  VALUES(1,6,1,'SUCCESS','2026-10-21 00:00+00','REQUEST',1,'$',decode(repeat('aa',32),'hex'),'IMPORTED_UNIT','$.observations[0]')$q$,'23514');
-- Same time and same artifact, independent request position: never merge by legacy groupId.
INSERT INTO collection_request(run_id,ordinal,definition_id,state,observed_at,observation_clock,artifact_id,selector_prefix,evidence_kind,source_position)
  VALUES(1,7,1,'SUCCESS','2026-10-21 00:00+00','REPORT_FALLBACK',1,'$.requests[7]','IMPORTED_REQUEST','$.requests[7]');
INSERT INTO observation VALUES(1,'2026-10-21 00:00+00',8,1,'OBSERVED',0.5,NULL);
INSERT INTO observation(series_id,observed_at,request_id,request_definition_id,state,amount) VALUES
  (1,'2026-10-21 00:00+00',1,1,'OBSERVED','0.999999999999999999999999999999999999'),
  (2,'2026-10-21 00:00+00',1,1,'OBSERVED','900719925474099300000.000000000000000000000000000000000001'),
  (3,'2026-10-21 00:00+00',2,2,'OBSERVED','0'),
  (1,'2026-10-21 00:01+00',3,1,'OBSERVED','0.999999999999999999999999999999999999'),
  (2,'2026-10-21 00:01+00',3,1,'MISSING',NULL);
INSERT INTO network_observation VALUES (1,'2026-10-21 00:00+00',6,4,'OBSERVED',true,9007199254740993,NULL);
SELECT assert_rejected($q$INSERT INTO observation VALUES(1,'2026-10-21 00:00+00',1,1,'OBSERVED',1,NULL)$q$,'23505');
SELECT assert_rejected($q$INSERT INTO observation VALUES(1,'2026-10-21 00:00:01+00',1,1,'OBSERVED',1,NULL)$q$,'23503');
SELECT assert_rejected($q$INSERT INTO observation VALUES(3,'2026-10-21 00:01+00',3,1,'OBSERVED',1,NULL)$q$,'23503');
SELECT assert_rejected($q$INSERT INTO observation VALUES(2,'2026-10-21 00:01+00',3,1,'MISSING',0,NULL)$q$,'23514');
SELECT assert_rejected($q$INSERT INTO observation VALUES(2,'2026-10-21 00:01+00',3,1,'OBSERVED',NULL,NULL)$q$,'23514');
SELECT assert_rejected($q$SELECT '0.0000000000000000000000000000000000001'::amount_decimal$q$,'23514');
SELECT assert_rejected($q$SELECT '-1'::amount_decimal$q$,'23514');
SELECT assert_rejected($q$SELECT 'NaN'::amount_decimal$q$,'23514');
SELECT assert_rejected($q$SELECT 'Infinity'::amount_decimal$q$,'23514');
SELECT assert_rejected($q$SELECT 1e78::amount_decimal$q$,'23514');
SELECT assert_rejected($q$INSERT INTO observation VALUES(1,'2026-11-01 00:00+00',1,1,'OBSERVED',1,NULL)$q$,'23514');
INSERT INTO series_latest VALUES (1,'2026-10-21 00:01+00',3);
INSERT INTO series_latest VALUES (1,'2026-10-21 00:00+00',1)
  ON CONFLICT(series_id) DO UPDATE SET observed_at=excluded.observed_at,request_id=excluded.request_id
  WHERE (excluded.observed_at,excluded.request_id) > (series_latest.observed_at,series_latest.request_id);
INSERT INTO legacy_observation VALUES(decode(repeat('44',32),'hex'),decode(repeat('55',32),'hex'),
  '$.requests[1].data.totalSupply.fixture',1,3,'2026-10-21 00:00+00',2);
INSERT INTO series_rollup VALUES(1,3600,'2026-10-21 00:00+00','2026-10-21 00:00+00','2026-10-21 00:01+00',
  0.999,1,0.99,0.999,2,0,0,0,0,1,2,now());
SELECT assert_rejected($q$INSERT INTO series_rollup VALUES(2,3600,'2026-10-21 00:01+00','2026-10-21 00:01+00','2026-10-21 00:02+00',1,1,1,1,1,0,0,0,0,1,2,now())$q$,'23514');
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM deployment WHERE coin_id=1 AND network_id=1)=2,'multiple deployments lost';
  ASSERT (SELECT amount::text FROM observation WHERE series_id=2 AND request_id=1)='900719925474099300000.000000000000000000000000000000000001','precision loss';
  ASSERT (SELECT count(*) FROM observation WHERE series_id=1)=3,'equal re-observation suppressed';
  ASSERT (SELECT amount FROM observation WHERE series_id=3)=0,'explicit zero lost';
  ASSERT (SELECT count(*) FROM observation WHERE request_id IN (4,5))=0,'failure invented a value';
  ASSERT (SELECT request_id FROM series_latest WHERE series_id=1)=3,'late import regressed latest';
  ASSERT (SELECT tip::text FROM network_observation)='9007199254740993','tip precision loss';
  ASSERT (SELECT period_seconds IS NULL AND unit='UNKNOWN' AND semantic_state='UNCONFIRMED'
    FROM metric_definition WHERE code='REPORTED_VOLUME'),'unknown volume misclassified';
END $$;
DO $$ DECLARE net integer; dep_a integer; dep_b integer; subj_a integer; subj_b integer; met integer; ser integer; def integer;
BEGIN
  INSERT INTO network(code,family,network_identity) VALUES('fixture-xrpl','XRPL','fixture-network-0') RETURNING id INTO net;
  INSERT INTO deployment(code,coin_id,network_id,identity_kind,identity_key,identity_display)
    VALUES('fixture-issuer-a',1,net,'ISSUED','fixtureIssuerA:USD','{"issuer":"fixtureIssuerA","currency":"USD"}') RETURNING id INTO dep_a;
  INSERT INTO deployment(code,coin_id,network_id,identity_kind,identity_key,identity_display)
    VALUES('fixture-issuer-b',1,net,'ISSUED','fixtureIssuerB:USD','{"issuer":"fixtureIssuerB","currency":"USD"}') RETURNING id INTO dep_b;
  INSERT INTO subject(scope,coin_id,network_id,deployment_id) VALUES('DEPLOYMENT',1,net,dep_a) RETURNING id INTO subj_a;
  INSERT INTO subject(scope,coin_id,network_id,deployment_id) VALUES('DEPLOYMENT',1,net,dep_b) RETURNING id INTO subj_b;
  INSERT INTO metric_definition(code,version,scope,unit,semantic_state,definition)
    VALUES('OBLIGATIONS',1,'DEPLOYMENT','token','DEFINED','Synthetic fixture') RETURNING id INTO met;
  INSERT INTO series(subject_id,metric_id,scope,provider_id,endpoint_path,selector_suffix)
    VALUES(subj_a,met,'DEPLOYMENT',1,'/gateway_balances','.value') RETURNING id INTO ser;
  INSERT INTO request_definition(provider_id,endpoint_path,version,target_subject_id,request_kind,request_shape)
    VALUES(1,'/gateway_balances',1,subj_b,'XRPL_GATEWAY_BALANCES','{"target":{"issuer":"fixtureIssuerB","currency":"USD","network_identity":"fixture-network-0"}}') RETURNING id INTO def;
  PERFORM assert_rejected(format('INSERT INTO request_series VALUES(%s,%s,1,%L)',def,ser,'/gateway_balances'),'23514');
  INSERT INTO request_definition(provider_id,endpoint_path,version,target_subject_id,request_kind,request_shape)
    VALUES(1,'/gateway_balances',1,subj_a,'XRPL_GATEWAY_BALANCES','{"target":{"issuer":"fixtureIssuerB","currency":"USD","network_identity":"fixture-network-0"}}') RETURNING id INTO def;
  PERFORM assert_rejected(format('INSERT INTO request_series VALUES(%s,%s,1,%L)',def,ser,'/gateway_balances'),'23514');
END $$;
-- UTC day boundaries must remain identical even in a timezone with DST transitions.
SET timezone='America/New_York';
INSERT INTO series_rollup VALUES(2,86400,'2026-11-01 00:00+00','2026-11-01 00:00+00','2026-11-01 23:59:59+00',1,1,1,1,1,0,0,0,0,1,2,now());
SELECT assert_rejected($q$INSERT INTO series_rollup VALUES(3,86400,'2026-11-01 00:00+00','2026-11-01 00:00+00','2026-11-02 00:00+00',1,1,1,1,1,0,0,0,0,1,2,now())$q$,'23514');
SET timezone='UTC';
CREATE ROLE atlas_design_reader NOLOGIN;
GRANT USAGE ON SCHEMA atlas_market_design TO atlas_design_reader;
GRANT SELECT,INSERT ON observation TO atlas_design_reader;
SET ROLE atlas_design_reader;
DO $$ BEGIN ASSERT (SELECT count(*) FROM atlas_market_design.observation)=0,'RLS exposed rows'; END $$;
SELECT assert_rejected($q$INSERT INTO atlas_market_design.observation VALUES(1,'2026-10-21 00:00+00',1,1,'OBSERVED',1,NULL)$q$,'42501');
SELECT assert_rejected($q$SELECT count(*) FROM atlas_market_design.observation_2026_10$q$,'42501');
RESET ROLE;
\echo DESIGN_SQL_VALIDATION_PASS
