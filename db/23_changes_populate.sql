-- Insert unknown changes in main table
\timing
CREATE INDEX ON :update_table using btree(osmid, version);

WITH unknown AS (
	SELECT fu.*
	FROM :update_table fu
	LEFT JOIN :features_table f ON f.osmid=fu.osmid AND f.version=fu.version
	WHERE f.osmid IS NULL
)
INSERT INTO :features_table
SELECT u.*
FROM unknown u;

ANALYZE :features_table;
