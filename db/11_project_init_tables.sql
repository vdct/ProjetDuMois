-- Clean-up raw OSM changes table
DROP TABLE IF EXISTS pdm_changes;
CREATE TABLE pdm_changes(
	action VARCHAR NOT NULL,
	osmid VARCHAR NOT NULL,
	version INT NOT NULL,
	ts TIMESTAMP NOT NULL,
	username VARCHAR,
	userid BIGINT,
	tags JSONB
);
