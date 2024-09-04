from utils import CONFIG, PROJECTS, dbCursor
from datetime import date, datetime, timedelta
from urllib.parse import quote
import requests
from psycopg.sql import SQL, Identifier
from psycopg.errors import UndefinedTable


# Boundaries
with dbCursor() as cur:
	if CONFIG.get("DB_USE_IMPOSM_UPDATE", True):
		print("Updating boundaries definition")
		cur.execute("""
			REFRESH MATERIALIZED VIEW pdm_boundary;
			REFRESH MATERIALIZED VIEW pdm_boundary_subdivide;
		""")


# Notes
print("Retrieving notes statistics")
with dbCursor() as cur:
	userNames = {}

	for pid, pinfo in PROJECTS.items():
		# Is there any notes to count in project ?
		notesSources = [ s for s in pinfo["datasources"] if s["source"] == "notes" ]
		if len(notesSources) > 0:
			print(f"  - Processing {pid}")
			pointsPerNote = pinfo.get("statistics",{}).get("points", {}).get("note", 1)

			# Check which dates are in DB
			dbDays = cur.execute("SELECT ts FROM pdm_note_counts WHERE project = %s ORDER BY ts", [pid]).fetchall()
			dbDays = [ t["ts"].date().isoformat() for t in dbDays ]
			pstart = date.fromisoformat(pinfo["start_date"])
			yesterday = date.today() - timedelta(days=1)
			if pstart <= yesterday:
				allDays = [(pstart + timedelta(days=i)) for i in range((yesterday - pstart).days + 1)]
				notesPerDay = {}
				minDay = None
				for d in allDays:
					if d.isoformat() not in dbDays:
						if minDay is None:
							minDay = d.isoformat()
							print(f"    - Fetching data from {minDay}")
						notesPerDay[d.isoformat()] = {"open": 0, "closed": 0}

				# Download notes
				if len(notesPerDay) > 0:
					countedNotes = set()
					userNotes = {}
					for noteSource in notesSources:
						for term in noteSource["terms"]:
							url = f"{CONFIG.get('OSM_URL')}/api/0.6/notes/search.json?q={quote(term, safe='')}&limit=10000&closed=-1&from={minDay}"
							notesOsm = requests.get(url).json()

							# Process received notes
							for note in notesOsm["features"]:
								noteId = note["properties"]["id"]
								if noteId not in countedNotes:
									# Count note during it lifetime
									countedNotes.add(noteId)
									noteStart = date.fromisoformat(note["properties"]["date_created"][0:10])
									noteEnd = date.fromisoformat(note["properties"]["closed_at"][0:10]) if "closed_at" in note["properties"] else date.today()
									for npd in notesPerDay:
										npdate = date.fromisoformat(npd)
										if note["properties"]["status"] == "closed" and noteEnd <= npdate:
											notesPerDay[npd]["closed"] += 1
										elif noteStart <= npdate <= noteEnd:
											notesPerDay[npd]["open"] += 1
									
									# Count note as a user contribution
									if len(note["properties"]["comments"]) > 0 and note["properties"]["comments"][0].get("uid") is not None:
										noteCom = note["properties"]["comments"][0]
										userNames[noteCom["uid"]] = noteCom["user"]
										if noteCom["uid"] not in userNotes:
											userNotes[noteCom["uid"]] = []
										userNotes[noteCom["uid"]].append(
											datetime.strptime(
												note["properties"]["date_created"],
												"%Y-%m-%d %H:%M:%S %Z"
											)
										)
					
					# Import note counts
					print(f"    - Import note counts in DB")
					for day, notecount in notesPerDay.items():
						cur.execute("""
							INSERT INTO pdm_note_counts(project, ts, open, closed)
							VALUES (%(pid)s, %(day)s, %(nbopen)s, %(nbclosed)s)
							ON CONFLICT (project, ts) DO UPDATE SET open = %(nbopen)s, closed = %(nbclosed)s
						""", {
							"pid": pid,
							"day": day,
							"nbopen": notecount["open"],
							"nbclosed": notecount["closed"],
						})
					
					# Import user notes
					print(f"    - Import note contributions in DB")
					for uid, nts in userNotes.items():
						# Check already imported ts for notes
						dbnts = cur.execute("""
							SELECT ts
							FROM pdm_user_contribs
							WHERE project = %(pid)s
							AND userid = %(uid)s
							AND contribution = 'note'
						""", {"pid": pid, "uid": uid}).fetchall()
						dbnts = [ t["ts"] for t in dbnts ]

						for nt in nts:
							if nt not in dbnts:
								cur.execute("""
									INSERT INTO pdm_user_contribs(project, userid, ts, contribution, points)
									VALUES(%s, %s, %s, 'note', %s)
								""", [pid, uid, nt, pointsPerNote])
				
				else:
					print("    - All stats already in DB")
		
	# Insert usernames
	if len(userNames) > 0:
		print("Importing user names read from notes")
		for uid, uname in userNames.items():
			cur.execute("""
				INSERT INTO pdm_user_names(userid, username)
				VALUES(%(id)s, %(n)s)
				ON CONFLICT (userid) DO UPDATE SET username = %(n)s
			""", {"id": uid, "n": uname})


# Counting features
print("Processing features daily count")
with dbCursor() as cur:
	for pid, pinfo in PROJECTS.items():
		# Count features
		if pinfo["statistics"].get("count") == True:
			print(f"  - Processing {pid}")
			# Check if yesterday count is set
			dbCnt = cur.execute(
				"SELECT * FROM pdm_feature_counts WHERE project = %s AND ts = current_date - 1",
				[pid]
			).fetchone()
			if dbCnt is None:
				cur.execute(SQL("""
					INSERT INTO pdm_feature_counts(project, ts, amount)
					SELECT %s, current_date - 1, COUNT(*)
					FROM {table}
				""").format(
					table=Identifier(f"pdm_project_{pinfo['short_id']}")
				), [pid])
		else:
			print(f"  - Skipped {pid} (count disabled)")


# Counting features per boundary
with dbCursor() as cur:
	try:
		bnd = cur.execute("SELECT * FROM pdm_boundary LIMIT 1").fetchone()
	except UndefinedTable:
		bnd = None
	
	if bnd is not None:
		print("Processing features daily count per boundary")
		for pid, pinfo in PROJECTS.items():
			# Count features
			if pinfo["statistics"].get("count") == True:
				print(f"  - Processing {pid}")
				cur.execute(SQL("""
					UPDATE pdm_features_boundary fb
					SET boundary=b.osm_id
					FROM {table} f, pdm_boundary_subdivide b
					WHERE
						fb.boundary IS NULL
						AND fb.osmid = f.osm_id
						AND ST_Within(f.geom, b.geom);

					INSERT INTO pdm_feature_counts_per_boundary(project, boundary, ts, amount)
					SELECT %(pid)s, boundary, current_date - 1, count(*) as amount
					FROM pdm_features_boundary
					WHERE project=%(pid)s
						AND (start_ts IS NULL OR start_ts <= current_date)
						AND (end_ts IS NULL OR end_ts >= current_date)
					GROUP BY project, boundary
					ON CONFLICT (project,boundary,ts) DO UPDATE SET amount=EXCLUDED.amount
				""").format(
					pid=pid,
					table=Identifier(f"pdm_project_{pinfo["short_id"]}"),
				))

	else:
		print("Skipped features daily count per boundary (no boundary set)")


# Boundaries
print("Updating count of features per boundary")
with dbCursor() as cur:
	cur.execute("REFRESH MATERIALIZED VIEW pdm_boundary_tiles;")


print("Done!")
