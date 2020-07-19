SET SESSION my.pdm.project_id = '2020-06_covid';

-- Clean-up user contributions
DELETE FROM user_contributions
WHERE project = current_setting('my.pdm.project_id');

-- Read contributions from osm_changes
INSERT INTO user_contributions
SELECT current_setting('my.pdm.project_id') AS project, userid, ts, 'rm_covid' AS contribution
FROM (
	SELECT *,
		lag(tags ? 'opening_hours:covid19') OVER w AS prev_has_ohc19,
		NOT tags ? 'opening_hours:covid19' AS curr_hasno_ohc19
	FROM osm_changes
	WINDOW w AS (PARTITION BY osmid ORDER BY version)
) a
WHERE prev_has_ohc19 AND curr_hasno_ohc19 AND ts_in_project(ts);

-- Reindex for performance
REINDEX TABLE user_contributions;

--
-- Badges
--

-- Contributed to project
INSERT INTO user_badges(userid, project, badge)
SELECT DISTINCT userid, project, 'contributed' AS badge
FROM user_contributions
WHERE project = current_setting('my.pdm.project_id')
ON CONFLICT DO NOTHING;

-- 3 best contributors
DELETE FROM user_badges
WHERE project = current_setting('my.pdm.project_id') AND badge IN ('score_1st', 'score_2nd', 'score_3rd');

INSERT INTO user_badges(userid, project, badge)
SELECT
	userid, project,
	CASE
		WHEN pos = 1 THEN 'score_1st'
		WHEN pos = 2 THEN 'score_2nd'
		WHEN pos = 3 THEN 'score_3rd'
	END AS badge
FROM (
	SELECT row_number() over () AS pos, *
	FROM (
		SELECT userid, project, COUNT(*) AS amount
		FROM user_contributions
		WHERE project = current_setting('my.pdm.project_id')
		GROUP BY userid, project
		ORDER BY COUNT(*) DESC
		LIMIT 3
	) a
) a
ON CONFLICT DO NOTHING;

-- Meta
INSERT INTO user_badges(userid, project, badge)
SELECT DISTINCT userid, 'meta', 'covid19' AS badge
FROM user_contributions
WHERE project = current_setting('my.pdm.project_id')
ON CONFLICT DO NOTHING;

REINDEX TABLE user_badges;
