-- Qualification des changements
UPDATE pdm_changes SET contrib='add' WHERE contrib IS NULL AND version=1;

UPDATE pdm_changes SET contrib='edit' WHERE contrib IS NULL AND version>1;