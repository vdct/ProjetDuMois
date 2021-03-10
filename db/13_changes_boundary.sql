-- Insert unknown features and associate them with enclosing boundaries
WITH unknown AS (
	SELECT p.osm_id AS osmid, b.osm_id AS boundary
	FROM :project_table p
	LEFT JOIN pdm_features_boundary fb ON fb.project=:project_id AND fb.osmid=p.osm_id
	JOIN pdm_boundary_subdivide b ON ST_Intersects(p.geom, b.geom)
	WHERE fb.osmid IS NULL
	GROUP BY p.osm_id, b.osm_id
)
INSERT INTO pdm_features_boundary
SELECT :project_id AS project, u.osmid AS osmid, u.boundary, '2004-01-01T00:00:00' AS start_ts
FROM unknown u;

-- Update start and end dates for each features according to changes
WITH changes AS (
	SELECT c.project, c.osmid,
	CASE WHEN c.action='create' THEN c.ts ELSE NULL END AS start_ts,
	CASE WHEN c.action='delete' THEN c.ts ELSE NULL END AS end_ts
	FROM pdm_changes_tmp c
	WHERE c.project=:project_id
), features AS (
	SELECT project, osmid, MAX(start_ts) AS start_ts, MAX(end_ts) AS end_ts
	FROM changes
	GROUP BY osmid, project
)
UPDATE pdm_features_boundary b SET start_ts=COALESCE(f.start_ts, b.start_ts), end_ts=COALESCE(f.end_ts, b.end_ts) FROM features f WHERE b.project=f.project AND b.osmid=f.osmid;
