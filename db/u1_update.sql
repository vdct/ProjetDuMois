ALTER TABLE user_names RENAME TO pdm_user_names
ALTER TABLE user_names_nodes RENAME TO pdm_user_names_notes;

ALTER TABLE user_contributions RENAME TO pdm_user_contribs;

ALTER TABLE user_badges RENAME TO pdm_user_badges;

ALTER TABLE feature_counts RENAME TO pdm_feature_counts;

ALTER TABLE note_counts RENAME TO pdm_note_counts;

ALTER VIEW leaderboard RENAME TO pdm_leaderboard;

ALTER TABLE osm_compare_exclusions RENAME TO pdm_compare_exclusions;