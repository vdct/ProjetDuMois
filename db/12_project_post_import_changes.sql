-- Create indexes
CREATE INDEX osm_changes_action_idx ON osm_changes(action);
CREATE INDEX osm_changes_osmid_idx ON osm_changes(osmid);
CREATE INDEX osm_changes_version_idx ON osm_changes(version);

-- Update user names
INSERT INTO user_names
SELECT DISTINCT ON (userid) userid, username
FROM osm_changes
WHERE userid IS NOT NULL
ORDER BY userid, ts DESC
ON CONFLICT (userid)
DO UPDATE SET username = EXCLUDED.username;

-- Compute indexes
REINDEX TABLE user_names;
