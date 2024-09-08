import os
import json
from pathlib import Path
import psycopg
from psycopg.sql import SQL, Literal, Identifier
from psycopg.rows import dict_row
from contextlib import contextmanager
from typing import Optional, Tuple, Dict, List
import subprocess
import sys
import requests
from lxml import etree
import gzip
import math


######################################
# Configuration
#

def getCodePath(*dirs) -> str:
	"""Get absolute path to a file in this repository"""
	return os.path.join(os.path.dirname(__file__), "..", *dirs)

with open(getCodePath("config.json"), "r", encoding="utf-8") as file:
	CONFIG = json.load(file)

def getWorkPath(*dirs) -> str:
	"""Get absolute path to a file in work directory (as defined in config.json)"""
	return os.path.join(CONFIG.get("WORK_DIR"), *dirs)

PROJECTS = {}

for project_id in [ Path(f.path).stem for f in os.scandir(getCodePath("projects")) if f.is_dir() ]:
	with open(getCodePath("projects", project_id, "info.json"), "r", encoding="utf-8") as f:
		try:
			PROJECTS[project_id] = json.load(f)
			PROJECTS[project_id]["short_id"] = project_id.split("_")[-1]
		except json.JSONDecodeError as e:
			print(f"Malformed info.json file for project {project_id}: {e}")


######################################
# Database
#

@contextmanager
def dbConnect():
	"""Psycopg connect function wrapped to use DB_URL connexion info"""
	with psycopg.connect(os.getenv("DB_URL"), row_factory=dict_row) as conn:
		yield conn


@contextmanager
def dbCursor():
	"""Psycopg cursor function wrapped to use DB_URL connexion info"""
	with dbConnect() as conn, conn.cursor() as cursor:
		yield cursor


def deployView(cur, name: str, isMaterial: bool = False):
	"""Make a view go from import schema to public"""

	req = SQL(f"ALTER {'MATERIALIZED' if isMaterial else ''} VIEW IF EXISTS")
	cur.execute(SQL("{r} {v} SET SCHEMA backup").format(r=req, v=name))
	cur.execute(SQL("{r} import.{v} SET SCHEMA public").format(r=req, v=name))


def createMergedView(cur, pinfo, types, suffix: str = ""):
	"""Creates view grouping all Imposm per-type tables"""

	pview = Identifier(f"pdm_project_{pinfo["short_id"]}{suffix}")
	sqlTypes = []
	for t in types:
		osmid = SQL(
			"CONCAT('node/', osm_id) AS osm_id" if t == "point"
			else "CASE WHEN osm_id < 0 THEN CONCAT('relation/', -osm_id) ELSE CONCAT('way/', osm_id) END AS osm_id"
		)
		geom = SQL(
			"geom::GEOMETRY(Point, 3857)" if t == "point"
			else "ST_PointOnSurface(geom)::GEOMETRY(Point, 3857) AS geom"
		)
		sqlTypes.append(SQL("""
			SELECT
				{oid},
				name,
				hstore_to_json(tags) AS tags,
				tags ?| ARRAY['note','fixme'] AS needs_check,
				{g}
				FROM import.{tn}
		""").format(
			oid=osmid,
			g=geom,
			tn=Identifier(f"pdm_project_{pinfo["short_id"]}{suffix}_{t}"),
		))
	
	cur.execute(SQL("""
		CREATE VIEW import.{n} AS
		{st}
	""").format(
		n=pview,
		st=SQL(" UNION ALL ").join(sqlTypes)
	))


######################################
# System
#

def runCmd(cmd):
	"""Launch a system command, with live standard output printed"""
	try:
		with subprocess.Popen(cmd, stdout=subprocess.PIPE) as process:
			for c in iter(lambda: process.stdout.read(1), b""):
				sys.stdout.buffer.write(c)
	except FileNotFoundError as e:
		raise Exception(f"Command {cmd[0]} not found") from e


def runCmdTxt(cmd):
	"""Launch a system command and get its output as text result"""
	result = subprocess.run(cmd, capture_output=True, text=True)
	if result.stderr:
		raise Exception(f"Command {cmd[0]} raised an issue: {result.stderr}")
	return result.stdout


def download(url, output, label, headers={}):
	"""Downloads a remote file only if it has changed"""
	if os.path.exists(output):
		print(f"Checking if {label} needs to be downloaded")
		# Compare last modified time locally and remote
		last_modified_time = os.path.getmtime(output)
		import email.utils as eut
		last_modified_str = eut.formatdate(last_modified_time, usegmt=True)
		response = requests.head(url, headers=headers)
		last_modified_remote = response.headers.get('Last-Modified')
		etag_remote = response.headers.get('ETag')

		# Conditional download
		dlHeaders = {} | headers
		if last_modified_remote:
			dlHeaders['If-Modified-Since'] = last_modified_str
		if etag_remote:
			dlHeaders['If-None-Match'] = etag_remote
		print(f"Downloading {label}")
		with requests.get(url, stream=True, headers=dlHeaders) as response:
			if response.status_code == 304:
				print(f"Skipped download of {label} as it hasn't changed")
			elif response.status_code == 200:
				with open(output, 'wb') as f:
					for chunk in response.iter_content(chunk_size=8192):
						if chunk:
							f.write(chunk)
				print(f"Successfully downloaded {label}")
			else:
				raise Exception(f"Error {response.status_code} when downloading {label}: {response.text}")
	else:
		print(f"Downloading {label}")
		with requests.get(url, stream=True, headers=headers) as response:
			if response.status_code >= 400:
				raise Exception(f"Error {response.status_code} when downloading {label}: {response.text}")
			with open(output, 'wb') as f:
				for chunk in response.iter_content(chunk_size=8192):
					if chunk:
						f.write(chunk)
			print(f"Successfully downloaded {label}")


######################################
# OSM analyzing
#

def getNextDiff(lastReadSeq: Optional[int]) -> Optional[Tuple[int, etree._Element]]:
	"""Find path of next OSC diff file to read"""

	IMPOSM_DIFFS = getWorkPath("imposm_diff")
	nextDiffPath = None
	nextSeq = None

	# Sequence ID given by DB
	if lastReadSeq is not None:
		nextSeq = lastReadSeq + 1
		a = math.floor(nextSeq / 1000000)
		b = math.floor((nextSeq % 1000000) / 1000)
		c = nextSeq % 1000
		nextDiffPath = f"{a:03}/{b:03}/{c:03}.osc.gz"
		if not os.path.isfile(os.path.join(IMPOSM_DIFFS, nextDiffPath)):
			nextDiffPath = None
	
	# Find first diff by listing Imposm folder
	else:
		try:
			a = [d for d in os.listdir(IMPOSM_DIFFS) if os.path.isdir(os.path.join(IMPOSM_DIFFS, d))]
			a.sort()
			a = a[0]
			b = os.path.join(IMPOSM_DIFFS, a)
			b = [d for d in os.listdir(b) if os.path.isdir(os.path.join(b, d))]
			b.sort()
			b = b[0]
			c = os.path.join(IMPOSM_DIFFS, a, b)
			c = [f for f in os.listdir(c) if os.path.isfile(os.path.join(c, f)) and f.endswith(".osc.gz")]
			c.sort()
			c = c[0]
			nextDiffPath = f"{a}/{b}/{c}"
			nextSeq = int(a) * 1000000 + int(b) * 1000 + int(c[0:3])
		except:
			pass
	
	if nextDiffPath is not None:
		with gzip.open(os.path.join(IMPOSM_DIFFS, nextDiffPath), "rb") as f:
			raw = f.read()
			osc = etree.fromstring(raw)
			return (nextSeq, osc)


def getAllTags(elem: etree._Element):
	"""Get all tags for this element"""
	tags = {}
	for t in elem.iter("tag"):
		if len(t.attrib.get("k", "")) > 0 and len(t.attrib.get("v", "")) > 0:
			tags[t.attrib["k"]] = t.attrib["v"]
	return tags


def hasAllTags(elem: etree._Element, mapping: Dict[str,List[str]]) -> bool:
	"""Check if a feature has all wanted tags defined

	Parameters
	----------
	elem: etree.Element
		The OSM feature to check
	mapping: dict
		The Imposm import mapping (tags to check)
	
	Returns
	-------
	bool
		True if elem has all required tags
	"""

	elemTags = getAllTags(elem)

	# Are all wanted tags there
	for k,vs in mapping.items():
		elemV = elemTags.get(k)
		if vs == "__any__":
			if elemV is None:
				return False
		else:
			if elemV not in vs:
				return False

	return True
