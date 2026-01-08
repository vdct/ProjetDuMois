-- Update user names
\timing
ANALYSE pdm_user_names;
ANALYSE :features_table;

-- Handle dates list
CREATE TEMP TABLE IF NOT EXISTS pdm_mapper_counts_dates (ts timestamp, ts_past timestamp, ts1d timestamp, ts30d timestamp, tswindow timestamp); TRUNCATE TABLE pdm_mapper_counts_dates;
INSERT INTO pdm_mapper_counts_dates (ts, ts_past) VALUES :dates_list;
UPDATE pdm_mapper_counts_dates SET ts1d=ts - interval '1 day', ts30d=ts - interval '30 days', tswindow=least(ts - interval '30 days', :project_start_date);
CREATE INDEX ON pdm_mapper_counts_dates using btree(ts);
CREATE INDEX ON pdm_mapper_counts_dates using btree(ts1d);
CREATE INDEX ON pdm_mapper_counts_dates using btree(ts30d);

-- Update teams userids
WITH uknownusers AS (
    SELECT DISTINCT un.username, un.userid
    FROM pdm_projects_teams pt
    LEFT JOIN pdm_user_names un ON un.username=pt.username
    WHERE pt.userid IS NULL AND un.userid iS NOT NULL
)
UPDATE pdm_projects_teams SET userid=uknownusers.userid FROM uknownusers WHERE uknownusers.username=pdm_projects_teams.username;

-- Establishing user contributions in every running project
DELETE FROM pdm_user_contribs WHERE project_id=:project_id AND ts >= :start_date;

WITH features as (
    SELECT d.ts::date, fc.osmid, fc.version, fc.userid, fc.contrib, fl.contrib as label_contrib, coalesce(fl.label,'no-label') as label, fc.geom_len, fc.geom_area, fc.geom_len_delta, fc.geom_area_delta
    FROM :changes_table fc
    JOIN pdm_mapper_counts_dates d ON fc.ts_start BETWEEN d.ts_past AND d.ts
    LEFT JOIN :labels_table fl ON fl.osmid=fc.osmid AND fl.version=fc.version
    WHERE fc.tagsfilter=true
), counts as (
    SELECT 
      f.ts,
      f.userid,
      f.label,
      f.contrib,
      f.label_contrib,
      count(distinct concat(f.osmid, f.version)) as nb,
      count(*) FILTER (WHERE f.label != 'no-label') as nb_label,
      SUM(f.geom_len) / count(distinct f.label) as geom_len,
      SUM(f.geom_len_delta) / count(distinct f.label) as geom_len_delta,
      SUM(f.geom_area) / count(distinct f.label) as geom_area,
      SUM(f.geom_area_delta) / count(distinct f.label) as geom_area_delta
    FROM features f
    GROUP BY f.ts, f.userid, f.contrib, f.label_contrib, ROLLUP(f.label)
    HAVING f.label != 'no-label' OR f.label IS NULL
), contributions as (
    SELECT c.userid,
      c.ts,
      c.label,
      CASE
        when c.label is null then c.contrib
        else c.label_contrib
      end as contrib,
      CASE
        when c.label is null then c.nb
        else c.nb_label
      end as nb,
      CASE
        when c.label is null and (c.contrib='edit-in' OR c.contrib='add') then c.geom_len
        when c.label is not null and c.label_contrib='edit-in' then c.geom_len
        else c.geom_len_delta
      end as geom_len_delta,
      CASE
        when c.label is null and (c.contrib='edit-in' OR c.contrib='add') then c.geom_area
        when c.label is not null and c.label_contrib='edit-in' then c.geom_area
        else c.geom_area_delta
      end as geom_area_delta
    FROM counts c
)
INSERT INTO pdm_user_contribs(project_id, userid, ts, label, contribution, amount_delta, len_delta, area_delta, points)
    SELECT :project_id as project_id,
      cc.userid,
      cc.ts,
      cc.label,
      cc.contrib AS contribution,
      SUM(case
        when cc.contrib='edit-in' then cc.nb
        when cc.contrib='add' then cc.nb
        when cc.contrib='edit-out' then -cc.nb
        else 0
        end) as amount_delta,
      SUM(cc.geom_len_delta) as len_delta,
      SUM(cc.geom_area_delta) AS area_delta,
      SUM(cc.nb * pp.points) AS points
    FROM contributions cc
    LEFT JOIN pdm_projects_points pp ON cc.contrib=pp.contrib AND cc.label=pp.label AND pp.project_id=:project_id
    GROUP BY project_id, cc.ts, cc.userid, cc.label, cc.contrib;

-- Main labels count
INSERT INTO pdm_mapper_counts (project_id, ts, label, amount, amount_1d, amount_30d)
  SELECT
      :project_id AS project_id,
      d.ts,
      fl.label,
      COUNT(DISTINCT CASE WHEN f.ts BETWEEN :project_start_date AND d.ts THEN f.userid END) AS amount,
      COUNT(DISTINCT CASE WHEN f.ts BETWEEN d.ts1d AND d.ts THEN f.userid END) AS amount_1d,
      COUNT(DISTINCT CASE WHEN f.ts BETWEEN d.ts30d AND d.ts THEN f.userid END) AS amount_30d
  FROM :features_table f
  JOIN :labels_table fl ON fl.osmid=f.osmid and fl.version=f.version
  JOIN pdm_mapper_counts_dates d ON f.ts BETWEEN d.tswindow AND d.ts
  WHERE f.tagsfilter = true
  GROUP BY d.ts, fl.label
ON CONFLICT (project_id, ts, label) DO UPDATE SET amount=EXCLUDED.amount, amount_1d=EXCLUDED.amount_1d, amount_30d=EXCLUDED.amount_30d;

-- Main rollup count
INSERT INTO pdm_mapper_counts (project_id, ts, label, amount, amount_1d, amount_30d)
  SELECT
      :project_id AS project_id,
      d.ts,
      null as label,
      COUNT(DISTINCT CASE WHEN f.ts BETWEEN :project_start_date AND d.ts THEN f.userid END) AS amount,
      COUNT(DISTINCT CASE WHEN f.ts BETWEEN d.ts1d AND d.ts THEN f.userid END) AS amount_1d,
      COUNT(DISTINCT CASE WHEN f.ts BETWEEN d.ts30d AND d.ts THEN f.userid END) AS amount_30d
  FROM :features_table f
  JOIN pdm_mapper_counts_dates d ON f.ts BETWEEN d.tswindow AND d.ts
  WHERE f.tagsfilter = true
  GROUP BY d.ts
ON CONFLICT (project_id, ts, label) DO UPDATE SET amount=EXCLUDED.amount, amount_1d=EXCLUDED.amount_1d, amount_30d=EXCLUDED.amount_30d;

-- Boundary labels count
INSERT INTO pdm_mapper_counts_per_boundary (project_id, boundary, ts, label, amount, amount_1d, amount_30d)
  SELECT
      :project_id AS project_id,
      fb.boundary as boundary,
      d.ts,
      fl.label,
      COUNT(DISTINCT CASE WHEN f.ts BETWEEN :project_start_date AND d.ts THEN f.userid END) AS amount,
      COUNT(DISTINCT CASE WHEN f.ts BETWEEN d.ts1d AND d.ts THEN f.userid END) AS amount_1d,
      COUNT(DISTINCT CASE WHEN f.ts BETWEEN d.ts30d AND d.ts THEN f.userid END) AS amount_30d
  FROM :features_table f
  JOIN :labels_table fl ON fl.osmid=f.osmid and fl.version=f.version
  JOIN :boundary_table fb ON fb.osmid=f.osmid AND fb.version=f.version
  JOIN pdm_mapper_counts_dates d ON f.ts BETWEEN d.tswindow AND d.ts
  WHERE f.tagsfilter = true
  GROUP BY fb.boundary, d.ts, fl.label
ON CONFLICT (project_id, boundary, ts, label) DO UPDATE SET amount=EXCLUDED.amount, amount_1d=EXCLUDED.amount_1d, amount_30d=EXCLUDED.amount_30d;

-- Boundary rollup count
INSERT INTO pdm_mapper_counts_per_boundary (project_id, boundary, ts, label, amount, amount_1d, amount_30d)
  SELECT
      :project_id AS project_id,
      fb.boundary as boundary,
      d.ts,
      null as label,
      COUNT(DISTINCT CASE WHEN f.ts BETWEEN :project_start_date AND d.ts THEN f.userid END) AS amount,
      COUNT(DISTINCT CASE WHEN f.ts BETWEEN d.ts1d AND d.ts THEN f.userid END) AS amount_1d,
      COUNT(DISTINCT CASE WHEN f.ts BETWEEN d.ts30d AND d.ts THEN f.userid END) AS amount_30d
  FROM :features_table f
  JOIN :boundary_table fb ON fb.osmid=f.osmid AND fb.version=f.version
  JOIN pdm_mapper_counts_dates d ON f.ts BETWEEN d.tswindow AND d.ts
  WHERE f.tagsfilter = true
  GROUP BY fb.boundary, d.ts
ON CONFLICT (project_id, boundary, ts, label) DO UPDATE SET amount=EXCLUDED.amount, amount_1d=EXCLUDED.amount_1d, amount_30d=EXCLUDED.amount_30d;

-- Clean up
DROP TABLE pdm_mapper_counts_dates;