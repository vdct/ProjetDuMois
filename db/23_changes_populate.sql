-- Insert unknown changes in main table
CREATE INDEX ON pdm_features_tmp using btree(project_id, osmid, version);

ALTER TABLE :features_table SET UNLOGGED;
WITH unknown AS (
	SELECT tmp.*
	FROM :features_table tmp
	LEFT JOIN :features_table pc ON pc.osmid=tmp.osmid AND pc.version=tmp.version
	WHERE pc.osmid IS NULL
)
INSERT INTO :features_table
SELECT u.*
FROM unknown u;

ALTER TABLE :features_table SET LOGGED;
REINDEX table :features_table;

CREATE INDEX ON pdm_features_tmp using gist(geom);