SET SESSION my.pdm.project_id = '2018-07_substation';

-- Clean-up user contributions
DELETE FROM user_contributions
WHERE project = current_setting('my.pdm.project_id');

-- Read contributions from osm_changes
INSERT INTO user_contributions
SELECT current_setting('my.pdm.project_id') AS project, userid, ts, 'add_substation' AS contribution
FROM (
	SELECT *
	FROM osm_changes
	WHERE version = 1 AND ts_in_project(ts) AND tags->>'power'='substation'
) a;

INSERT INTO user_contributions
SELECT current_setting('my.pdm.project_id') AS project, userid, ts, 'edit_substation' AS contribution
FROM (
	SELECT *
	FROM osm_changes
	WHERE version != 1 AND ts_in_project(ts) AND tags->>'power'='substation'
) a;

-- Reindex for performance
REINDEX TABLE user_contributions;
