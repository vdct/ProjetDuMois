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

-- Associate a given feature/version to a label
DROP TABLE IF EXISTS :labels_table CASCADE;
CREATE TABLE :labels_table (
	osmid VARCHAR NOT NULL,
	version INT NOT NULL,
	label varchar,
	contrib varchar
);

-- Associate a given feature/version to a boundary
DROP TABLE IF EXISTS :boundary_table CASCADE;
CREATE TABLE :boundary_table (
	osmid VARCHAR NOT NULL,
	version INT NOT NULL,
	boundary BIGINT
);
