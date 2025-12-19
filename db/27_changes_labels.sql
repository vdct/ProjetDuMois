-- Labeling features versions
\timing
WITH unknown AS (
	SELECT distinct f.osmid AS osmid,
	f.version as version,
	:label AS label
	FROM :features_table f
	LEFT JOIN :labels_table fl ON fl.osmid=f.osmid AND fl.version=f.version AND fl.label=:label
	WHERE fl.osmid IS NULL AND f.action!='delete' AND jsonb_path_exists(f.tags, :labelfilter) AND f.tagsfilter=true
)
INSERT INTO :labels_table
SELECT u.osmid AS osmid, u.version, u.label
FROM unknown u;

ANALYZE :labels_table;