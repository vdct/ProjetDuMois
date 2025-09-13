-- Remove existing counts
DELETE FROM pdm_feature_counts WHERE project=:project_id AND ts BETWEEN :start_date AND :end_date;
DELETE FROM pdm_feature_counts_per_boundary WHERE project=:project_id AND ts BETWEEN :start_date AND :end_date;

-- Handle dates list
CREATE TEMP TABLE IF NOT EXISTS pdm_features_counts_dates (ts timestamp); TRUNCATE TABLE pdm_features_counts_dates;
INSERT INTO pdm_features_counts_dates (ts) VALUES :dates_list;
CREATE INDEX ON pdm_features_counts_dates using btree(ts);

-- Main count
INSERT INTO pdm_feature_counts (project, ts, amount) 
    SELECT fc.project, d.ts, count(fc.osmid) as amount
    FROM pdm_features_changes fc
    JOIN pdm_features_counts_dates d 
    ON d.ts BETWEEN fc.ts_start AND fc.ts_end
    OR (d.ts > fc.ts_start AND fc.ts_end is null)
    WHERE fc.project=:project_id and action!='delete' and fc.tagsfilter=true
    GROUP BY fc.project, d.ts
ON CONFLICT (project,ts) DO UPDATE SET amount=EXCLUDED.amount;

-- Boundary count
INSERT INTO pdm_feature_counts_per_boundary (project, boundary, ts, amount) 
    SELECT fc.project, fb.boundary, d.ts, count(fc.osmid) as amount
    FROM pdm_features_changes fc
    JOIN pdm_features_boundary fb ON fb.project=fc.project and fb.osmid=fc.osmid AND fb.version=fc.version
    JOIN pdm_features_counts_dates d 
    ON d.ts BETWEEN fc.ts_start AND fc.ts_end
    OR (d.ts > fc.ts_start AND fc.ts_end is null)
    WHERE fc.project=:project_id and action!='delete' and fc.tagsfilter=true
    GROUP BY fc.project, fb.boundary, d.ts
 ON CONFLICT (project,boundary,ts) DO UPDATE SET amount=EXCLUDED.amount;

-- Clean up
DROP TABLE pdm_features_counts_dates;