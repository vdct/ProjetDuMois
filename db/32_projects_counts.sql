-- Remove existing counts
\timing
DELETE FROM pdm_feature_counts WHERE project_id=:project_id AND ts BETWEEN :start_date AND :end_date;
DELETE FROM pdm_feature_counts_per_boundary WHERE project_id=:project_id AND ts BETWEEN :start_date AND :end_date;

-- Handle dates list
CREATE TEMP TABLE IF NOT EXISTS pdm_features_counts_dates (ts timestamp); TRUNCATE TABLE pdm_features_counts_dates;
INSERT INTO pdm_features_counts_dates (ts) VALUES :dates_list;
CREATE INDEX ON pdm_features_counts_dates using btree(ts);

-- Main count
INSERT INTO pdm_feature_counts (project_id, ts, amount, len)
    SELECT :project_id as project_id, d.ts, count(fc.osmid) as amount, sum(fc.geom_len) as len
    FROM :changes_table fc
    JOIN pdm_features_counts_dates d
    ON d.ts BETWEEN fc.ts_start AND fc.ts_end
        OR (d.ts > fc.ts_start AND fc.ts_end is null)
    WHERE fc.action!='delete' AND fc.tagsfilter=true
    GROUP BY d.ts
ON CONFLICT (project_id,ts) DO UPDATE SET amount=EXCLUDED.amount, len=EXCLUDED.len;

-- Boundary count
INSERT INTO pdm_feature_counts_per_boundary (project_id, boundary, ts, amount, len)
    SELECT :project_id as project_id, fb.boundary, d.ts, count(fc.osmid) as amount, sum(fc.geom_len) as len
    FROM :changes_table fc
    JOIN :boundary_table fb ON fb.osmid=fc.osmid AND fb.version=fc.version
    JOIN pdm_features_counts_dates d
    ON d.ts BETWEEN fc.ts_start AND fc.ts_end
        OR (d.ts > fc.ts_start AND fc.ts_end is null)
    WHERE fc.action!='delete' AND fc.tagsfilter=true
    GROUP BY fb.boundary, d.ts
 ON CONFLICT (project_id,boundary,ts) DO UPDATE SET amount=EXCLUDED.amount, len=EXCLUDED.len;

-- Clean up
DROP TABLE pdm_features_counts_dates;
