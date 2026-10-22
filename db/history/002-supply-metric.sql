ALTER TABLE atlas_history.schema_version DROP CONSTRAINT schema_version_version_check;
ALTER TABLE atlas_history.schema_version ADD CONSTRAINT schema_version_version_check CHECK(version IN (1,2));
ALTER TABLE atlas_history.snapshot ADD COLUMN metric text NOT NULL DEFAULT 'NETWORK_CIRCULATING' CHECK(metric IN ('NETWORK_CIRCULATING','NETWORK_MINTED'));
ALTER TABLE atlas_history.snapshot DROP CONSTRAINT snapshot_pkey;
ALTER TABLE atlas_history.snapshot ADD PRIMARY KEY(coin_id,metric,source_hash,window_to);
DROP INDEX atlas_history.latest_snapshot;
CREATE INDEX latest_snapshot ON atlas_history.snapshot(coin_id,metric,fetched_at DESC,source_hash DESC,window_to DESC);
