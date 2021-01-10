-- Update user names
INSERT INTO pdm_user_names
SELECT DISTINCT ON (userid) userid, username
FROM pdm_changes
WHERE userid IS NOT NULL
ORDER BY userid, ts DESC
ON CONFLICT (userid)
DO UPDATE SET username = EXCLUDED.username;

-- Establishing user contributions in every running project
WITH projectChanges AS (
	SELECT c.project, c.userid, c.ts, c.contrib AS contribution, pp.points
	FROM pdm_changes c
	JOIN pdm_projects p ON p.project=c.project
	JOIN pdm_projects_points pp ON pp.project=c.project AND c.contrib=pp.contrib

	WHERE c.ts BETWEEN p.start_date AND p.end_date
)
INSERT INTO pdm_user_contribs(project, userid, ts, contribution, points)
SELECT * FROM projectChanges;

-- Reindex for performance
REINDEX TABLE pdm_user_contribs;