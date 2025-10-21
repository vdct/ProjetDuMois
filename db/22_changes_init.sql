DROP TABLE IF EXISTS :features_table CASCADE;
CREATE TABLE :features_table (
	osmid VARCHAR NOT NULL,
	version INT NOT NULL,
	ts TIMESTAMP NOT NULL,
	username VARCHAR,
	userid BIGINT,
	tags JSONB,
	geom geometry default null,
	action VARCHAR NOT NULL,
	contrib VARCHAR DEFAULT NULL,
	tagsfilter boolean
);

CREATE INDEX ON :features_table (osmid, version);
CREATE INDEX ON :features_table (action, tagsfilter);
CREATE INDEX ON :features_table (ts);
CREATE INDEX ON :features_table (userid);
CREATE INDEX ON :features_table using gist(geom);

DROP TABLE IF EXISTS :members_table CASCADE;
CREATE TABLE :members_table (
	osmid VARCHAR NOT NULL,
	version INT NOT NULL,
	memberid VARCHAR NOT NULL,
	pos int not null
);

CREATE INDEX ON :members_table (osmid, version, memberid, pos);
CREATE INDEX ON :members_table (osmid, version);
CREATE INDEX ON :members_table (memberid);

DROP MATERIALIZED VIEW IF EXISTS :changes_table;
CREATE MATERIALIZED VIEW :changes_table as
    SELECT
    c1.osmid,
    c1.version,
    c1.ts as ts_start,
    c2.ts as ts_end,
    c1.username,
    c1.userid,
    c1.tags,
    c1.action,
    c1.contrib,
    c1.tagsfilter,
    c1.geom,
    CASE when c1.geom is not null then St_Length(c1.geom::geography) else 0 end as geom_len
    FROM :features_table c1 
    LEFT JOIN :features_table c2
		ON c1.osmid=c2.osmid and c1.version=c2.version-1
	WHERE c1.action!='delete';

CREATE INDEX ON :changes_table (osmid, version);
CREATE INDEX ON :changes_table (action, tagsfilter);
CREATE INDEX ON :changes_table (ts_start, ts_end);
CREATE INDEX ON :changes_table using gist(geom);

-- Associate a given feature/version to a boundary
-- boundary can be null until we'll able to get geometry of deleted features
DROP TABLE IF EXISTS :boundary_table CASCADE;
CREATE TABLE :boundary_table (
	osmid VARCHAR NOT NULL,
	version INT NOT NULL,
	boundary BIGINT
);

CREATE INDEX ON :boundary_table USING btree(osmid, version);
CREATE INDEX ON :boundary_table USING btree(boundary);
