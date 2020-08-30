SET SESSION my.pdm.project_id = '2018-11_police';

-- Clean-up user contributions
DELETE FROM user_contributions
WHERE project = current_setting('my.pdm.project_id');

-- Read contributions from osm_changes
INSERT INTO user_contributions
SELECT current_setting('my.pdm.project_id') AS project, userid, ts, 'add' AS contribution
FROM (
	SELECT *
	FROM osm_changes
	WHERE version = 1 AND ts_in_project(ts) AND tags->>'amenity'='police'
) a;

INSERT INTO user_contributions
SELECT current_setting('my.pdm.project_id') AS project, userid, ts, 'edit' AS contribution
FROM (
	SELECT *
	FROM osm_changes
	WHERE version != 1 AND ts_in_project(ts) AND tags->>'amenity'='police'
) a;

-- Reindex for performance
REINDEX TABLE user_contributions;
