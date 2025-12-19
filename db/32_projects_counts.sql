-- Remove existing counts
\timing
ANALYSE :changes_table;
ANALYSE :labels_table;

DELETE FROM pdm_feature_counts WHERE project_id=:project_id AND ts BETWEEN :start_date AND :end_date;
DELETE FROM pdm_feature_counts_per_boundary WHERE project_id=:project_id AND ts BETWEEN :start_date AND :end_date;

-- Handle dates list
CREATE TEMP TABLE IF NOT EXISTS pdm_features_counts_dates (ts timestamp, ts_past timestamp); TRUNCATE TABLE pdm_features_counts_dates;
INSERT INTO pdm_features_counts_dates (ts, ts_past) VALUES :dates_list;
CREATE INDEX ON pdm_features_counts_dates using btree(ts, ts_past);

-- Main labels count
INSERT INTO pdm_feature_counts (project_id, ts, label, amount, len, area)
    SELECT :project_id as project_id, d.ts, fl.label as label, count(fc.osmid) as amount, sum(fc.geom_len) as len, sum(fc.geom_area) as area
    FROM :changes_table fc
    JOIN pdm_features_counts_dates d
    ON d.ts BETWEEN fc.ts_start AND fc.ts_end
        OR (d.ts > fc.ts_start AND fc.ts_end is null)
    JOIN :labels_table fl ON fl.osmid=fc.osmid AND fl.version=fc.version
    WHERE fc.tagsfilter=true 
    GROUP BY d.ts, fl.label
ON CONFLICT (project_id, ts, label) DO UPDATE SET amount=EXCLUDED.amount, len=EXCLUDED.len;

-- Main rollup count
INSERT INTO pdm_feature_counts (project_id, ts, label, amount, len, area)
    SELECT :project_id as project_id, d.ts, null as label, count(fc.osmid) as amount, sum(fc.geom_len) as len, sum(fc.geom_area) as area
    FROM :changes_table fc
    JOIN pdm_features_counts_dates d
    ON d.ts BETWEEN fc.ts_start AND fc.ts_end
        OR (d.ts > fc.ts_start AND fc.ts_end is null)
    WHERE fc.tagsfilter=true
    GROUP BY d.ts
ON CONFLICT (project_id, ts, label) DO UPDATE SET amount=EXCLUDED.amount, len=EXCLUDED.len;

-- Boundary labels count
INSERT INTO pdm_feature_counts_per_boundary (project_id, boundary, ts, label, amount, len, area)
    SELECT :project_id as project_id, fb.boundary, d.ts, fl.label as label, count(fc.osmid) as amount, sum(fc.geom_len) as len, sum(fc.geom_area) as area
    FROM :changes_table fc
    JOIN :boundary_table fb ON fb.osmid=fc.osmid AND fb.version=fc.version
    JOIN pdm_features_counts_dates d
    ON d.ts BETWEEN fc.ts_start AND fc.ts_end
        OR (d.ts > fc.ts_start AND fc.ts_end is null)
    JOIN :labels_table fl ON fl.osmid=fc.osmid AND fl.version=fc.version
    WHERE fc.tagsfilter=true
    GROUP BY fb.boundary, d.ts, fl.label
 ON CONFLICT (project_id, boundary, ts, label) DO UPDATE SET amount=EXCLUDED.amount, len=EXCLUDED.len;

-- Boundary rollup count
INSERT INTO pdm_feature_counts_per_boundary (project_id, boundary, ts, label, amount, len, area)
    SELECT :project_id as project_id, fb.boundary, d.ts, null as label, count(fc.osmid) as amount, sum(fc.geom_len) as len, sum(fc.geom_area) as area
    FROM :changes_table fc
    JOIN :boundary_table fb ON fb.osmid=fc.osmid AND fb.version=fc.version
    JOIN pdm_features_counts_dates d
    ON d.ts BETWEEN fc.ts_start AND fc.ts_end
        OR (d.ts > fc.ts_start AND fc.ts_end is null)
    WHERE fc.tagsfilter=true
    GROUP BY fb.boundary, d.ts
 ON CONFLICT (project_id, boundary, ts, label) DO UPDATE SET amount=EXCLUDED.amount, len=EXCLUDED.len;

-- Clean up
DROP TABLE pdm_features_counts_dates;
