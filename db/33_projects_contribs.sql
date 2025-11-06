-- Update user names
\timing
ANALYSE pdm_user_names;
ANALYSE :features_table;

WITH unknown_users AS (
  SELECT DISTINCT f.userid, f.username
  FROM :features_table f
  LEFT JOIN pdm_user_names un ON un.userid=f.userid
  WHERE f.ts BETWEEN :start_date AND :end_date
    AND f.userid IS NOT NULL
    AND tagsfilter
    AND un.username IS NULL
)
INSERT INTO pdm_user_names
SELECT u.userid, u.username
FROM unknown_users u;

-- Establishing user contributions in every running project
DELETE FROM pdm_user_contribs WHERE project_id=:project_id AND ts >= :start_date;

INSERT INTO pdm_user_contribs(project_id, userid, ts, contribution, amount, points)
	SELECT :project_id as project_id, f.userid, f.ts::date, f.contrib AS contribution, COUNT(*) AS amount, SUM(pp.points) AS points
	FROM :features_table f
	JOIN pdm_projects_points pp ON f.contrib=pp.contrib

	WHERE pp.project_id=:project_id AND f.ts BETWEEN :start_date AND :end_date AND f.tagsfilter=true
	GROUP BY f.userid, f.contrib, f.ts::date;

-- Handle dates list
CREATE TEMP TABLE IF NOT EXISTS pdm_mapper_counts_dates (ts timestamp, ts1d timestamp, ts30d timestamp); TRUNCATE TABLE pdm_mapper_counts_dates;
INSERT INTO pdm_mapper_counts_dates (ts) VALUES :dates_list;
UPDATE pdm_mapper_counts_dates SET ts1d=ts - interval '1 day', ts30d=ts - interval '30 days';
CREATE INDEX ON pdm_mapper_counts_dates using btree(ts);
CREATE INDEX ON pdm_mapper_counts_dates using btree(ts1d);
CREATE INDEX ON pdm_mapper_counts_dates using btree(ts30d);

-- Main labels count
INSERT INTO pdm_mapper_counts (project_id, ts, label, amount_1d, amount_30d)
  SELECT
      :project_id AS project_id,
      d.ts,
      fl.label,
      COUNT(DISTINCT CASE WHEN f.ts BETWEEN d.ts1d AND d.ts THEN f.userid END) AS amount_1d,
      COUNT(DISTINCT CASE WHEN f.ts BETWEEN d.ts30d AND d.ts THEN f.userid END) AS amount_30d
  FROM :features_table f
  JOIN :labels_table fl ON fl.osmid=f.osmid and fl.version=f.version
  JOIN pdm_mapper_counts_dates d ON f.ts BETWEEN d.ts30d AND d.ts
  WHERE f.tagsfilter = true
  GROUP BY d.ts, fl.label
ON CONFLICT (project_id, ts, label) DO UPDATE SET amount_1d=EXCLUDED.amount_1d, amount_30d=EXCLUDED.amount_30d;

-- Main rollup count
INSERT INTO pdm_mapper_counts (project_id, ts, label, amount_1d, amount_30d)
  SELECT
      :project_id AS project_id,
      d.ts,
      null as label,
      COUNT(DISTINCT CASE WHEN f.ts BETWEEN d.ts1d AND d.ts THEN f.userid END) AS amount_1d,
      COUNT(DISTINCT CASE WHEN f.ts BETWEEN d.ts30d AND d.ts THEN f.userid END) AS amount_30d
  FROM :features_table f
  JOIN pdm_mapper_counts_dates d ON f.ts BETWEEN d.ts30d AND d.ts
  WHERE f.tagsfilter = true
  GROUP BY d.ts
ON CONFLICT (project_id, ts, label) DO UPDATE SET amount_1d=EXCLUDED.amount_1d, amount_30d=EXCLUDED.amount_30d;

-- Boundary labels count
INSERT INTO pdm_mapper_counts_per_boundary (project_id, boundary, ts, label, amount_1d, amount_30d)
  SELECT
      :project_id AS project_id,
      fb.boundary as boundary,
      d.ts,
      fl.label,
      COUNT(DISTINCT CASE WHEN f.ts BETWEEN d.ts1d AND d.ts THEN f.userid END) AS amount_1d,
      COUNT(DISTINCT CASE WHEN f.ts BETWEEN d.ts30d AND d.ts THEN f.userid END) AS amount_30d
  FROM :features_table f
  JOIN :labels_table fl ON fl.osmid=f.osmid and fl.version=f.version
  JOIN :boundary_table fb ON fb.osmid=f.osmid AND fb.version=f.version
  JOIN pdm_mapper_counts_dates d ON f.ts BETWEEN d.ts30d AND d.ts
  WHERE f.tagsfilter = true
  GROUP BY fb.boundary, d.ts, fl.label
ON CONFLICT (project_id, boundary, ts, label) DO UPDATE SET amount_1d=EXCLUDED.amount_1d, amount_30d=EXCLUDED.amount_30d;

-- Boundary rollup count
INSERT INTO pdm_mapper_counts_per_boundary (project_id, boundary, ts, label, amount_1d, amount_30d)
  SELECT
      :project_id AS project_id,
      fb.boundary as boundary,
      d.ts,
      null as label,
      COUNT(DISTINCT CASE WHEN f.ts BETWEEN d.ts1d AND d.ts THEN f.userid END) AS amount_1d,
      COUNT(DISTINCT CASE WHEN f.ts BETWEEN d.ts30d AND d.ts THEN f.userid END) AS amount_30d
  FROM :features_table f
  JOIN :boundary_table fb ON fb.osmid=f.osmid AND fb.version=f.version
  JOIN pdm_mapper_counts_dates d ON f.ts BETWEEN d.ts30d AND d.ts
  WHERE f.tagsfilter = true
  GROUP BY fb.boundary, d.ts
ON CONFLICT (project_id, boundary, ts, label) DO UPDATE SET amount_1d=EXCLUDED.amount_1d, amount_30d=EXCLUDED.amount_30d;

-- Clean up
DROP TABLE pdm_mapper_counts_dates;