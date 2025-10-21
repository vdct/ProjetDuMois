-- Update user names
\timing
ANALYSE pdm_user_names;
ANALYSE :project_table;

WITH filtered_users AS (
  SELECT DISTINCT userid, username
  FROM :project_table
  WHERE ts BETWEEN :start_date AND :end_date
    AND userid IS NOT NULL
    AND tagsfilter
)
INSERT INTO pdm_user_names
SELECT fu.userid, fu.username
FROM filtered_users fu
WHERE NOT EXISTS (
  SELECT 1 FROM pdm_user_names u
  WHERE u.userid = fu.userid
);

-- Establishing user contributions in every running project
DELETE FROM pdm_user_contribs WHERE project_id=:project_id AND ts >= :start_date;

INSERT INTO pdm_user_contribs(project_id, userid, ts, contribution, amount, points)
	SELECT :project_id as project_id, f.userid, f.ts::date, f.contrib AS contribution, COUNT(*) AS amount, SUM(pp.points) AS points
	FROM :project_table f
	JOIN pdm_projects_points pp ON f.contrib=pp.contrib

	WHERE pp.project_id=:project_id AND f.ts BETWEEN :start_date AND :end_date AND f.tagsfilter=true
	GROUP BY f.userid, f.contrib, f.ts::date;
