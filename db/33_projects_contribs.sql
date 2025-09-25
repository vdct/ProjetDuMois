-- Update user names
INSERT INTO pdm_user_names
	SELECT DISTINCT ON (userid) userid, username
	FROM pdm_changes
	WHERE userid IS NOT NULL AND project=:project_id AND ts BETWEEN :start_date AND :end_date AND tagsfilter=true
	ORDER BY userid, ts DESC
ON CONFLICT (userid)
DO UPDATE SET username = EXCLUDED.username;

-- Establishing user contributions in every running project
DELETE FROM pdm_user_contribs WHERE project=:project_id AND ts >= :start_date;

INSERT INTO pdm_user_contribs(project, userid, ts, contribution, points)
	SELECT c.project, c.userid, c.ts, c.contrib AS contribution, pp.points
	FROM pdm_changes c
	JOIN pdm_projects p ON p.project=c.project
	JOIN pdm_projects_points pp ON pp.project=c.project AND c.contrib=pp.contrib

	WHERE c.project=:project_id AND c.ts BETWEEN :start_date AND :end_date AND c.tagsfilter=true;
