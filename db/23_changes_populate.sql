-- Insert unknown changes in main table
\timing
CREATE INDEX ON :features_table_tmp using btree(osmid, version);

WITH unknown AS (
	SELECT tmp.*
	FROM :features_table_tmp tmp
	LEFT JOIN :features_table pc ON pc.osmid=tmp.osmid AND pc.version=tmp.version
	WHERE pc.osmid IS NULL
)
INSERT INTO :features_table
SELECT u.*
FROM unknown u;

ANALYSE :features_table;
