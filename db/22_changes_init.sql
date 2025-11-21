DROP TABLE IF EXISTS :features_table CASCADE;
CREATE TABLE :features_table (
	osmid VARCHAR NOT NULL,
	version INT NOT NULL,
	ts TIMESTAMP NOT NULL,
	changeset bigint,
	userid BIGINT,
	tags JSONB,
	geom geometry default null,
	action VARCHAR NOT NULL,
	contrib VARCHAR DEFAULT NULL,
	tagsfilter boolean
);

DROP TABLE IF EXISTS :members_table CASCADE;
CREATE TABLE :members_table (
	osmid VARCHAR NOT NULL,
	version INT NOT NULL,
	memberid VARCHAR NOT NULL,
	pos int null,
	role varchar null
);

DROP MATERIALIZED VIEW IF EXISTS :changes_table;
CREATE MATERIALIZED VIEW :changes_table as
    SELECT
    osmid,
    version,
	changeset,
    ts as ts_start,
	LEAD(ts) OVER (PARTITION BY osmid ORDER BY version) AS ts_end,
    userid,
    tags,
    action,
    contrib,
    tagsfilter,
    geom,
    CASE when geom is not null then St_Length(geom::geography) else 0 end as geom_len,
	CASE when geom is not null and ST_IsClosed(geom) and St_geometrytype(geom) != 'ST_Point' then St_Area(ST_buildarea(geom)::geography) else 0 end as geom_area
    FROM :features_table
	WHERE action!='delete';

-- Associate a given feature/version to a label
DROP TABLE IF EXISTS :labels_table CASCADE;
CREATE TABLE :labels_table (
	osmid VARCHAR NOT NULL,
	version INT NOT NULL,
	label varchar
);

-- Associate a given feature/version to a boundary
DROP TABLE IF EXISTS :boundary_table CASCADE;
CREATE TABLE :boundary_table (
	osmid VARCHAR NOT NULL,
	version INT NOT NULL,
	boundary BIGINT
);
