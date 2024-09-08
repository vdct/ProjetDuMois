# Complete missing stats for older projects
#  which started before first PBF read

from utils import (
	CONFIG, PROJECTS, getWorkPath, getCodePath,
	download, runCmd, dbCursor, runCmdTxt, exportBounds
)
import os
from datetime import datetime, date, timedelta


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
	datetime.fromisoformat(oshDatesRaw[0]).date(),
	datetime.fromisoformat(oshDatesRaw[1]).date(),
)
print(f"    - OSH time span: {oshDates[0]} to {oshDates[1]}")

print("  - Extracting dates from database")
dbCounts = []
with dbCursor() as cur:
	# List stats already in DB
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

# List all available days in range projectsMinDate -> oshMaxDate
print("  - Counting features in OSH file")
OSM_COUNT_FILE = getWorkPath("counting.osm.pbf")
updatableDays = [(minDate + timedelta(days=i)) for i in range((oshDates[1] - minDate).days + 1)]
for ud in updatableDays:
	concernedProjects = []
	for pid, [pmind, pdates] in pCounts.items():
		if ud >= pmind and ud not in pdates:
			concernedProjects.append(pid)
	
	# Generate filtered OSH by time
	if len(concernedProjects) > 0:
		print(f"    - {ud}: updating projects {', '.join(concernedProjects)}")
		print("      - Time extract from OSH")
		runCmd([
			"osmium", "time-filter",
			"-O", "-o", OSM_COUNT_FILE,
			OSH_PBF_FILE,
			f"{ud.isoformat()}T23:59:59Z"
		])

		# Find all tags to count
		print("      - Counting tags")
		tagsToCount = []
		for pid, pinfo in PROJECTS.items():
			if pid in concernedProjects:
				pfilter = pinfo["database"]["imposm"]
				filtTag = next(iter(pfilter["mapping"].items()))
				tag = filtTag[0]
				if len(filtTag[1]) == 1 and filtTag[1][0] != "__any__":
					tag += "=" + ",".join(filtTag[1])
				tagsToCount.append(tag)
		
		# Count through Osmium -> generate list of key=val count
		tagsCountRaw = runCmdTxt([
			"osmium", "tags-count",
			OSM_COUNT_FILE
		] + tagsToCount)
		tagsCount = {}
		for tc in tagsCountRaw.split("\n"):
			if len(tc.strip()) > 0:
				vals = tc.split("\t")
				key = vals[1][1:-1]
				value = vals[2][1:-1] if len(vals) == 3 else "*"
				tagsCount[f"{key}={value}"] = vals[0]
		
		# Update DB with found counts
		print("      - Saving in database")
		with dbCursor() as cur:
			for pid, pinfo in PROJECTS.items():
				if pid in concernedProjects:
					count = 0
					pfilter = pinfo["database"]["imposm"]
					filtTag = next(iter(pfilter["mapping"].items()))
					key = filtTag[0]
					if len(filtTag[1]) == 1 and filtTag[1][0] != "__any__":
						for v in filtTag[1]:
							count += int(tagsCount.get(f"{key}={v}", "0"))
					else:
						count = int(tagsCount.get(f"{key}=*", "0"))
					
					cur.execute(
						"INSERT INTO pdm_feature_counts(project, ts, amount) VALUES(%s, %s, %s)",
						[pid, ud, count]
					)

		
# Cleanup
os.unlink(OSM_COUNT_FILE)