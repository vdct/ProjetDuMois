-- User names
DROP TABLE IF EXISTS pdm_user_names;

-- User contributions through all projects
DROP TABLE IF EXISTS pdm_user_contributions;

-- User badges
DROP TABLE IF EXISTS pdm_user_badges;
DROP FUNCTION IF EXISTS pdm_get_badges;

-- Features counts
DROP TABLE IF EXISTS pdm_feature_counts;

-- Note counts
DROP TABLE IF EXISTS pdm_note_counts;

-- Leaderboard view
DROP VIEW IF EXISTS pdm_leaderboard;

-- OSM compare feature exclusions
DROP TABLE IF EXISTS pdm_compare_exclusions;

-- Changes
DROP TABLE IF EXISTS pdm_changes;

-- Projects
DROP TABLE IF EXISTS pdm_projects;
DROP TABLE IF EXISTS pdm_projects_points;