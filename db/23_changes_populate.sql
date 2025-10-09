-- Insert unknown changes in main table
CREATE INDEX ON :features_table_tmp using btree(osmid, version);

ALTER TABLE :features_table SET UNLOGGED;
WITH unknown AS (
	SELECT tmp.*
	FROM :features_table_tmp tmp
	LEFT JOIN :features_table pc ON pc.osmid=tmp.osmid AND pc.version=tmp.version
	WHERE pc.osmid IS NULL
)
INSERT INTO :features_table
SELECT u.*
FROM unknown u;

ALTER TABLE :features_table SET LOGGED;
REINDEX table :features_table;

REFRESH MATERIALIZED VIEW :changes_table;

CREATE INDEX ON :features_table_tmp using gist(geom);
