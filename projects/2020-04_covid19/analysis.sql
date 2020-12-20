SET SESSION my.pdm.project_id = '2020-04_covid19';

-- Clean-up user contributions
DELETE FROM pdm_user_contribs
WHERE project = current_setting('my.pdm.project_id');

-- Read contributions from pdm_changes
INSERT INTO pdm_user_contribs(project, userid, ts, contribution, points)
SELECT current_setting('my.pdm.project_id') AS project, userid, ts, 'add', get_points(current_setting('my.pdm.project_id'), 'add')
FROM (
	SELECT *,
		lag(NOT tags ? 'opening_hours:covid19') OVER w AS prev,
		tags ? 'opening_hours:covid19' AS curr
	FROM pdm_changes
	WINDOW w AS (PARTITION BY osmid ORDER BY version)
) a
WHERE prev AND curr AND ts_in_project(ts);

INSERT INTO pdm_user_contribs(project, userid, ts, contribution, points)
SELECT current_setting('my.pdm.project_id') AS project, userid, ts, 'edit', get_points(current_setting('my.pdm.project_id'), 'edit')
FROM (
	SELECT *,
		lag(tags->>'opening_hours:covid19') OVER w AS prev,
		tags->>'opening_hours:covid19' AS curr
	FROM pdm_changes
	WINDOW w AS (PARTITION BY osmid ORDER BY version)
) a
WHERE prev IS NOT NULL AND curr IS NOT NULL AND prev != curr AND ts_in_project(ts);

-- Reindex for performance
REINDEX TABLE pdm_user_contribs;
