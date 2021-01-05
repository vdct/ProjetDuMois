WITH contribs AS (
    SELECT *,
		lag(NOT tags ? 'opening_hours:covid19') OVER w AS prev,
		tags ? 'opening_hours:covid19' AS curr
	FROM pdm_changes
	WINDOW w AS (PARTITION BY osmid ORDER BY version)
)
UPDATE pdm_changes SET contrib='add_covid'
WHERE pdm_changes.contrib IS NULL AND pdm_changes.project=contribs.project AND pdm_changes.osmid=contribs.osmid AND pdm_changes.ts=contribs.ts AND contribs.prev AND contribs.curr;

WITH contribs AS (
    SELECT *,
		lag(NOT tags ? 'opening_hours:covid19') OVER w AS prev,
		tags ? 'opening_hours:covid19' AS curr
	FROM pdm_changes
	WINDOW w AS (PARTITION BY osmid ORDER BY version)
)
UPDATE pdm_changes SET contrib='edit_covid'
WHERE pdm_changes.contrib IS NULL AND pdm_changes.project=contribs.project AND pdm_changes.osmid=contribs.osmid AND pdm_changes.ts=contribs.ts AND contribs.prev IS NOT NULL AND contribs.curr IS NOT NULL AND contribs.prev != contribs.curr;
