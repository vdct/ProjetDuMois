-- Create indexes
CREATE INDEX ON pdm_changes(action);
CREATE INDEX ON pdm_changes(osmid);
CREATE INDEX ON pdm_changes(version);

-- Update user names
INSERT INTO pdm_user_names
SELECT DISTINCT ON (userid) userid, username
FROM pdm_changes
WHERE userid IS NOT NULL
ORDER BY userid, ts DESC
ON CONFLICT (userid)
DO UPDATE SET username = EXCLUDED.username;

-- Compute indexes
REINDEX TABLE pdm_user_names;
REINDEX TABLE pdm_compare_exclusions;
