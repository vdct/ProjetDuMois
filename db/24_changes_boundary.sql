-- Insert unknown changes from :features_table and associate them with enclosing boundaries
ALTER TABLE :boundary_table SET UNLOGGED;
WITH unknown AS (
	SELECT f.osmid AS osmid,
	f.version as version,
	b.osm_id AS boundary
	FROM :features_table f
	JOIN pdm_boundary_subdivide b ON ST_Intersects(f.geom, b.geom)
	LEFT JOIN :boundary_table fb ON fb.osmid=f.osmid AND fb.version=f.version AND fb.boundary=b.osm_id
	WHERE fb.osmid IS NULL AND f.action!='delete'
)
INSERT INTO :boundary_table
SELECT u.osmid AS osmid, u.version, u.boundary
FROM unknown u;

ALTER TABLE :boundary_table SET LOGGED;
REINDEX table :boundary_table;
