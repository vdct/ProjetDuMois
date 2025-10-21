DELETE FROM pdm_feature_counts WHERE project_id=:project_id;
DELETE FROM pdm_feature_counts_per_boundary WHERE project_id=:project_id;
DELETE FROM pdm_note_counts WHERE project_id=:project_id;
DELETE FROM pdm_user_contribs WHERE project_id=:project_id;
UPDATE pdm_projects SET counts_lastupdate_date=NULL WHERE project_id=:project_id;
