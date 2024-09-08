# Complete missing stats for older projects
#  which started before first PBF read

from utils import (
	CONFIG, PROJECTS, getWorkPath, getCodePath,
	download, runCmd, dbCursor, runCmdTxt
)
import os
from datetime import datetime


# Get a cookie to allow full-history download
# print("Getting cookie for GeoFabrik OSM Internal download")
OSH_PBF_FILE = getWorkPath("data.osh.pbf")
# COOKIES = getWorkPath("cookie.txt")
# runCmd([
# 	"python3", getCodePath("lib", "sendfile_osm_oauth_protector", "oauth_cookie_client.py"),
# 	"--osm-host", CONFIG.get("OSM_URL"),
# 	"-u", CONFIG.get("OSM_USER"),
# 	"-p", CONFIG.get("OSM_PASS"),
# 	"-c", f"{"/".join(CONFIG.get("OSH_PBF_URL").split("/")[:3])}/get_cookie",
# 	"-o", COOKIES
# ])

# with open(COOKIES, "r") as f:
# 	COOKIES_TXT = f.read().split("/")[0]

# # Download if necessary history OSH PBF file
# download(CONFIG.get("OSH_PBF_URL"), OSH_PBF_FILE, "OSH PBF data", {"Cookie": COOKIES_TXT})

# # Remove cookie file
# os.unlink(COOKIES)


# Count features
print("Computing missing statistics")
print("  - Extracting dates from OSH file")
oshDatesRaw = runCmdTxt([
	"osmium", "fileinfo",
	"-e", OSH_PBF_FILE
])
oshDatesRaw = [ t.split(": ")[1] for t in oshDatesRaw.split("\n") if "First:" in t or "Last:" in t ]
oshDates = (
	datetime.fromisoformat(oshDatesRaw[0]).date().isoformat(),
	datetime.fromisoformat(oshDatesRaw[1]).date().isoformat(),
)
print(f"    - OSH time span: {oshDates[0]} to {oshDates[1]}")

print("  - Extracting dates from database")
with dbCursor() as cur:
	dbCounts = cur.execute("""
		SELECT p.project, p.start_date::date AS start_date, array_agg(c.ts) AS counted_dates
		FROM pdm_projects p
		LEFT JOIN pdm_feature_counts c ON p.project = c.project
		GROUP BY p.project
	""").fetchall()
	pCounts = {}
	minDate = None
	for dbc in dbCounts:
		pCounts[dbc["project"]] = (dbc["start_date"], dbc["counted_dates"])
		if minDate is None or dbc["start_date"] < minDate:
			minDate = dbc["start_date"]

	print(minDate, pCounts)
	# TODO : for each date, give list of project to count
