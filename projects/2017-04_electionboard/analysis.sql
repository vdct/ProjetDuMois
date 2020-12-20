SET SESSION my.pdm.project_id = '2017-04_electionboard';

-- Clean-up user contributions
DELETE FROM pdm_user_contribs
WHERE project = current_setting('my.pdm.project_id');

-- Read contributions from pdm_changes
INSERT INTO pdm_user_contribs(project, userid, ts, contribution, points)
SELECT current_setting('my.pdm.project_id') AS project, userid, ts, 'add', get_points(current_setting('my.pdm.project_id'), 'add')
FROM (
	SELECT *
	FROM pdm_changes
	WHERE version = 1 AND ts_in_project(ts) AND tags->>'advertising'='board' AND tags->>'message'='political'
) a;

INSERT INTO pdm_user_contribs(project, userid, ts, contribution, points)
SELECT current_setting('my.pdm.project_id') AS project, userid, ts, 'edit', get_points(current_setting('my.pdm.project_id'), 'edit')
FROM (
	SELECT *
	FROM pdm_changes
	WHERE version != 1 AND ts_in_project(ts) AND tags->>'advertising'='board' AND tags->>'message'='political'
) a;

-- Reindex for performance
REINDEX TABLE pdm_user_contribs;
