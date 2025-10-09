-- User names
DROP TABLE IF EXISTS pdm_user_names CASCADE;

-- User contributions through all projects
DROP TABLE IF EXISTS pdm_user_contribs CASCADE;

-- User badges
DROP TABLE IF EXISTS pdm_user_badges CASCADE;
DROP FUNCTION IF EXISTS pdm_get_badges CASCADE;

-- Features counts
DROP TABLE IF EXISTS pdm_feature_counts CASCADE;
DROP TABLE IF EXISTS pdm_feature_counts_per_boundary CASCADE;

-- Note counts
DROP TABLE IF EXISTS pdm_note_counts CASCADE;

-- Leaderboard view
DROP VIEW IF EXISTS pdm_leaderboard CASCADE;

-- OSM compare feature exclusions
DROP TABLE IF EXISTS pdm_compare_exclusions CASCADE;

-- Projects
DROP TABLE IF EXISTS pdm_projects CASCADE;
DROP TABLE IF EXISTS pdm_projects_points CASCADE;
