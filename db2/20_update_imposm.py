from utils import CONFIG, getWorkPath, runCmd

if CONFIG.get("DB_USE_IMPOSM_UPDATE", True):
	print("Updating Imposm tables")
	# This runs forever, so may be started as a background task
	runCmd([
		"imposm", "run",
		"-config", getWorkPath("imposm_config.json")
	])

else:
	print("Database is managed externally, no update to run on our side!")
