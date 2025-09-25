-- Features changes population script

-- Insert changes
INSERT INTO pdm_changes
SELECT *
FROM pdm_changes_tmp
ON CONFLICT (project,osmid,version)
DO UPDATE SET tags=EXCLUDED.tags, ts=EXCLUDED.ts, username=EXCLUDED.username, action=EXCLUDED.action;
