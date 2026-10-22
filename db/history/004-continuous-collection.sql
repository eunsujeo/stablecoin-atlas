-- Explicit owner-only transition; executed inside the verified migration transaction.
-- Access-exclusive locking keeps the temporary trigger removal invisible to writers.
LOCK TABLE atlas_history.scheduler_day IN ACCESS EXCLUSIVE MODE;
DO $$ DECLARE prior integer; BEGIN
 SELECT budget INTO prior FROM atlas_history.scheduler_day
 WHERE job='ARKHAM' AND day=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date;
 IF prior IS NOT NULL AND prior NOT IN (12,288) THEN
  RAISE EXCEPTION 'SCHEDULER_BUDGET_MISMATCH' USING ERRCODE='23514';
 END IF;
END $$;
DROP TRIGGER immutable_record ON atlas_history.scheduler_day;
UPDATE atlas_history.scheduler_day SET budget=288
 WHERE job='ARKHAM' AND day=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date AND budget=12;
CREATE TRIGGER immutable_record BEFORE UPDATE OR DELETE ON atlas_history.scheduler_day
 FOR EACH ROW EXECUTE FUNCTION atlas_history.reject_mutation();
ALTER TABLE atlas_history.schema_version DROP CONSTRAINT schema_version_version_check;
ALTER TABLE atlas_history.schema_version ADD CONSTRAINT schema_version_version_check CHECK(version IN (1,2,3,4));
