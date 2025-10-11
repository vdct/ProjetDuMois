-- Update user names
INSERT INTO pdm_user_names
	SELECT DISTINCT ON (userid) userid, username
	FROM :project_table
	WHERE userid IS NOT NULL AND ts BETWEEN :start_date AND :end_date AND tagsfilter=true
	ORDER BY userid, ts DESC
ON CONFLICT (userid)
DO UPDATE SET username = EXCLUDED.username;

-- Establishing user contributions in every running project
DELETE FROM pdm_user_contribs WHERE project_id=:project_id AND ts >= :start_date;

# TODO convert ts to date
INSERT INTO pdm_user_contribs(project_id, userid, ts, contribution, points)
	SELECT :project_id as project_id, c.userid, c.ts, c.contrib AS contribution, COUNT(*) AS amount, SUM(pp.points) AS points
	FROM :project_table c
	JOIN pdm_projects_points pp ON c.contrib=pp.contrib

	WHERE pp.project_id=:project_id AND c.ts BETWEEN :start_date AND :end_date AND c.tagsfilter=true
	GROUP BY c.userid, c.contrib;
