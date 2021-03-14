-- Features changes population script

-- Update actions
UPDATE pdm_changes_tmp SET contrib='add' WHERE contrib IS NULL AND version=1;
UPDATE pdm_changes_tmp SET contrib='edit' WHERE contrib IS NULL AND version>1 AND action='modify';
UPDATE pdm_changes_tmp SET contrib='delete' WHERE contrib IS NULL AND version>1 AND action='delete';

-- Insert changes
INSERT INTO pdm_changes
SELECT *
FROM pdm_changes_tmp
ON CONFLICT (project,osmid,version)
DO UPDATE SET tags=EXCLUDED.tags, ts=EXCLUDED.ts, username=EXCLUDED.username, action=EXCLUDED.action;
