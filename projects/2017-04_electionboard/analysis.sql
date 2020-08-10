SET SESSION my.pdm.project_id = '2017-04_electionboard';

-- Clean-up user contributions
DELETE FROM user_contributions
WHERE project = current_setting('my.pdm.project_id');

-- Read contributions from osm_changes
INSERT INTO user_contributions
SELECT current_setting('my.pdm.project_id') AS project, userid, ts, 'add_board' AS contribution
FROM (
	SELECT *
	FROM osm_changes
	WHERE version = 1 AND ts_in_project(ts) AND tags->>'advertising'='board' AND tags->>'message'='political'
) a;

INSERT INTO user_contributions
SELECT current_setting('my.pdm.project_id') AS project, userid, ts, 'edit_board' AS contribution
FROM (
	SELECT *
	FROM osm_changes
	WHERE version != 1 AND ts_in_project(ts) AND tags->>'advertising'='board' AND tags->>'message'='political'
) a;

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

-- 3 best contributors (including ex aqueos)
DELETE FROM user_badges
WHERE project = current_setting('my.pdm.project_id') AND badge IN ('score_1st', 'score_2nd', 'score_3rd');

INSERT INTO user_badges(userid, project, badge)
WITH stats AS (
	SELECT userid, project, COUNT(*) AS amount
	FROM user_contributions
	WHERE project = current_setting('my.pdm.project_id')
	GROUP BY userid, project
	ORDER BY COUNT(*) DESC
), scores AS (
	SELECT
		CASE
			WHEN pos = 1 THEN 'score_1st'
			WHEN pos = 2 THEN 'score_2nd'
			WHEN pos = 3 THEN 'score_3rd'
		END AS badge,
		amount
	FROM (
		SELECT row_number() over () AS pos, amount
		FROM (
			SELECT DISTINCT amount
			FROM stats
			ORDER BY amount DESC
			LIMIT 3
		) a
	) a
)
SELECT userid, project, badge
FROM stats
JOIN scores ON scores.amount = stats.amount
ON CONFLICT DO NOTHING;

-- Meta
INSERT INTO user_badges(userid, project, badge)
SELECT DISTINCT userid, 'meta', 'electionboard' AS badge
FROM user_contributions
WHERE project = current_setting('my.pdm.project_id')
ON CONFLICT DO NOTHING;

REINDEX TABLE user_badges;
