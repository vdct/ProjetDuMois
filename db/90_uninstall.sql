-- User names
DROP TABLE IF EXISTS user_names;

-- User contributions through all projects
DROP TABLE IF EXISTS user_contributions;$

-- User badges
DROP TABLE IF EXISTS user_badges;
DROP FUNCTION IF EXISTS  get_badges;

-- Features counts
DROP TABLE IF EXISTS feature_counts;

-- Note counts
DROP TABLE IF EXISTS note_counts;

-- Leaderboard view
DROP VIEW IF EXISTS leaderboard;

-- OSM compare feature exclusions
DROP TABLE IF EXISTS osm_compare_exclusions;

-- Projects
DROP TABLE IF EXISTS osm_changes;