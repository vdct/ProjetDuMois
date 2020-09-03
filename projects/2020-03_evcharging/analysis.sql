SET SESSION my.pdm.project_id = '2020-03_evcharging';

-- Clean-up user contributions
DELETE FROM user_contributions
WHERE project = current_setting('my.pdm.project_id');

-- Read contributions from osm_changes
INSERT INTO user_contributions(project, userid, ts, contribution, points)
SELECT current_setting('my.pdm.project_id') AS project, userid, ts, 'add', 3
FROM (
	SELECT *
	FROM osm_changes
	WHERE version = 1 AND ts_in_project(ts) AND tags->>'amenity'='charging_station'
) a;

INSERT INTO user_contributions(project, userid, ts, contribution)
SELECT current_setting('my.pdm.project_id') AS project, userid, ts, 'edit'
FROM (
	SELECT *
	FROM osm_changes
	WHERE version != 1 AND ts_in_project(ts) AND tags->>'amenity'='charging_station'
) a;

-- Reindex for performance
REINDEX TABLE user_contributions;
