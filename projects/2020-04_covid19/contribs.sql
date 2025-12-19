WITH contribs AS (
    SELECT *,
		lag(NOT tags ? 'opening_hours:covid19') OVER w AS prev,
		tags ? 'opening_hours:covid19' AS curr
	FROM pdm_features_covid19
	WINDOW w AS (PARTITION BY osmid ORDER BY version)
)
UPDATE pdm_features_covid19 SET contrib='edit_covid'
FROM contribs
WHERE pdm_features_covid19.contrib IS NULL AND pdm_features_covid19.osmid=contribs.osmid AND pdm_features_covid19.ts=contribs.ts AND contribs.prev IS NOT NULL AND contribs.curr IS NOT NULL AND contribs.prev != contribs.curr;
