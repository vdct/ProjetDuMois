SET SESSION my.pdm.project_id = '2017-04_electionboard';

-- Clean-up user contributions
DELETE FROM user_contributions
WHERE project = current_setting('my.pdm.project_id');

-- Read contributions from osm_changes
INSERT INTO user_contributions(project, userid, ts, contribution, points)
SELECT current_setting('my.pdm.project_id') AS project, userid, ts, 'add', get_points(current_setting('my.pdm.project_id'), 'add')
FROM (
	SELECT *
	FROM osm_changes
	WHERE version = 1 AND ts_in_project(ts) AND tags->>'advertising'='board' AND tags->>'message'='political'
) a;

INSERT INTO user_contributions(project, userid, ts, contribution, points)
SELECT current_setting('my.pdm.project_id') AS project, userid, ts, 'edit', get_points(current_setting('my.pdm.project_id'), 'edit')
FROM (
	SELECT *
	FROM osm_changes
	WHERE version != 1 AND ts_in_project(ts) AND tags->>'advertising'='board' AND tags->>'message'='political'
) a;

-- Reindex for performance
REINDEX TABLE user_contributions;
