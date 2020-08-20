-- Best contributors through all projects
DELETE FROM user_badges
WHERE project='meta' AND badge='allbest';

INSERT INTO user_badges(userid, project, badge)
SELECT userid, 'meta' AS project, 'allbest' AS badge
FROM user_contributions
GROUP BY userid
ORDER BY COUNT(*) DESC
LIMIT 1;
