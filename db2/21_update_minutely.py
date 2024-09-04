from utils import CONFIG, PROJECTS, dbCursor, getNextDiff, hasAllTags, getAllTags
from lxml import etree
import json


if CONFIG.get("DB_USE_IMPOSM_UPDATE", True):
	print("Reading latest diff files...")

	# Read each project latest read diff
	for pid, pinfo in PROJECTS.items():
		print(f"  - Analyzing project {pid}")
		pfilter = pinfo["database"]["imposm"]

		# Create lxml findall rule for rough filtering features
		filtTag = next(iter(pfilter["mapping"].items()))
		oscfind = f".//tag[@k=\"{filtTag[0]}\"]"
		if len(filtTag[1]) == 1 and filtTag[1][0] != "__any__":
			oscfind += f"[@v=\"{filtTag[1][0]}\"].."
		else:
			oscfind += ".."
		needsRefine = len(pfilter["mapping"]) > 1 or len(filtTag[1]) > 1

		# Find last read sequence from DB
		lastReadSeq = None
		with dbCursor() as cur:
			pdb = cur.execute("SELECT max_sequence_nb FROM pdm_read_diff WHERE project = %s", [pid]).fetchone()
			if pdb is not None:
				lastReadSeq = pdb["max_sequence_nb"]
			
			# Starting reading through diff files
			nextDiff = getNextDiff(lastReadSeq)

			if nextDiff is not None:
				firstDiff = None
				lastDiff = None
				while nextDiff is not None:
					seq, osc = nextDiff

					# Check if any feature is interesting in diff
					features = osc.findall(oscfind)
					for f in features:
						if not needsRefine or hasAllTags(f, pfilter["mapping"]):
							action = f.getparent().tag # create, modify, delete
							osmid = f"{f.tag}/{f.attrib['id']}"
							fts = f.attrib["timestamp"]

							# Gather contrib info
							cur.execute("""
								INSERT INTO pdm_changes(project, action, osmid, version, ts, username, userid, tags)
								VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
								ON CONFLICT DO NOTHING
							""", [
								pid,
								action,
								osmid,
								f.attrib["version"],
								fts,
								f.attrib["user"],
								f.attrib["uid"],
								json.dumps(getAllTags(f))
							])

							# Add feature in per-boundary listing
							cur.execute("""
								INSERT INTO pdm_features_boundary (project, osmid, start_ts, end_ts)
								VALUES (%(pid)s, %(oid)s, %(sts)s, %(ets)s)
								ON CONFLICT (project, osmid) DO UPDATE SET
									boundary = CASE WHEN %(act)s = 'modify' THEN NULL ELSE pdm_features_boundary.boundary END,
									start_ts = CASE WHEN %(act)s = 'create' THEN %(sts)s ELSE pdm_features_boundary.start_ts END,
									end_ts = CASE WHEN %(act)s = 'delete' THEN %(ets)s ELSE pdm_features_boundary.end_ts END
							""", {
								"pid": pid,
								"oid": osmid,
								"sts": fts if action == "create" else None,
								"ets": fts if action == "delete" else None,
								"act": action,
							})

					# Read next diff
					nextDiff = getNextDiff(seq)

					# Save diff info (for DB)
					tsf = osc.find(".//*[@timestamp]")
					if tsf is not None:
						if firstDiff is None:
							firstDiff = (seq, tsf.attrib["timestamp"])
						lastDiff = (seq, tsf.attrib["timestamp"])
				
				# Save last read sequence in DB
				if firstDiff is not None and lastDiff is not None:
					if pdb is None:
						cur.execute("""
							INSERT INTO pdm_read_diff(project, min_sequence_nb, min_ts, max_sequence_nb, max_ts)
							VALUES (%s, %s, %s, %s, %s)
						""", [
							pid,
							firstDiff[0],
							firstDiff[1],
							lastDiff[0],
							lastDiff[1]
						])
					else:
						cur.execute("""
							UPDATE pdm_read_diff
							SET min_sequence_nb = least(min_sequence_nb, %s),
								min_ts = least(min_ts, %s),
								max_sequence_nb = greatest(max_sequence_nb, %s),
								max_ts = greatest(max_ts, %s)
							WHERE project = %s
						""", [
							firstDiff[0],
							firstDiff[1],
							lastDiff[0],
							lastDiff[1],
							pid
						])
			else:
				print("    - No more diff available")


else:
	print("Database is managed externally, no update to run on our side!")
