-- Explicit, transactional upgrade. Original source and version-1 records stay immutable.
ALTER TABLE atlas_survey.schema_version DROP CONSTRAINT schema_version_version_check;
ALTER TABLE atlas_survey.schema_version ADD CONSTRAINT schema_version_version_check CHECK(version IN(1,2));
ALTER TABLE atlas_survey.source DROP CONSTRAINT source_mapper_check;
ALTER TABLE atlas_survey.source DROP CONSTRAINT source_window_from_check;
ALTER TABLE atlas_survey.source DROP CONSTRAINT source_window_to_check;
ALTER TABLE atlas_survey.source ADD CONSTRAINT source_mapper_check CHECK(mapper IN('allium-stored-survey-v1','allium-stored-survey-window-v2'));
ALTER TABLE atlas_survey.source ADD CONSTRAINT source_window_contract CHECK(
 (mapper='allium-stored-survey-v1' AND window_from=DATE '2026-10-16' AND window_to=DATE '2026-10-22') OR
 (mapper='allium-stored-survey-window-v2' AND window_from>=DATE '2000-01-01' AND window_to<DATE '9999-12-31' AND window_to-window_from=6)
);
