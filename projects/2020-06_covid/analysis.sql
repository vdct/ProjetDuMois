-- Clean-up user contributions
DELETE FROM user_contributions
WHERE project = '2020-06_covid';

-- Read contributions from osm_changes
INSERT INTO user_contributions
SELECT '2020-06_covid' AS project, userid, ts, 'rm_covid' AS contribution
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
