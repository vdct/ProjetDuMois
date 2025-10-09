-- Insert unknown changes from pdm_features_tmp and associate them with enclosing boundaries
ALTER TABLE :boundary_table SET UNLOGGED;
WITH unknown AS (
	SELECT tmp.osmid AS osmid,
	tmp.version as version,
	b.osm_id AS boundary
	FROM :features_table_tmp tmp
	JOIN pdm_boundary_subdivide b ON ST_Intersects(tmp.geom, b.geom)
	LEFT JOIN :boundary_table fb ON fb.osmid=tmp.osmid AND fb.version=tmp.version AND fb.boundary=b.osm_id
	WHERE fb.osmid IS NULL AND tmp.action!='delete'
)
INSERT INTO :boundary_table
SELECT u.osmid AS osmid, u.version, u.boundary
FROM unknown u;

ALTER TABLE :boundary_table SET LOGGED;
REINDEX table :boundary_table;
