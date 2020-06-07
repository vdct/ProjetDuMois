CREATE TABLE osm_changes(
	action VARCHAR NOT NULL,
	osmid VARCHAR NOT NULL,
	version INT NOT NULL,
	ts TIMESTAMP NOT NULL,
	username VARCHAR NOT NULL,
	userid VARCHAR NOT NULL,
	tags TEXT
);

COPY osm_changes FROM 'diffs/changes.csv' CSV HEADER DELIMITER ';';

-- Clean-up OSM tags
ALTER TABLE osm_changes ADD COLUMN tags_json JSONB;
UPDATE osm_changes SET tags_json = regexp_replace(tags, E'[\\n\\r\\t]+', ' ', 'g')::jsonb;
ALTER TABLE osm_changes DROP COLUMN tags;
ALTER TABLE osm_changes RENAME COLUMN tags_json TO tags;

-- Indexes
CREATE INDEX osm_changes_osmid_idx ON osm_changes(osmid);
CREATE INDEX osm_changes_version_idx ON osm_changes(version);

-- Find interesting changes
SELECT *
FROM (
	SELECT *,
		lag(tags ? 'delivery:covid19') OVER w AS prev_has_dc19,
		NOT tags ? 'delivery:covid19' AS curr_hasno_dc19
	FROM osm_changes
	WINDOW w AS (PARTITION BY osmid ORDER BY version)
) a
WHERE prev_has_dc19 AND curr_hasno_dc19;
