from utils import CONFIG, PROJECTS, dbCursor
from psycopg.sql import SQL, Identifier

print("Uninstalling PdM tables")
with dbCursor() as cur:
	# Imposm-related tables
	if CONFIG.get("DB_USE_IMPOSM_UPDATE", True):
		cur.execute("""
			DROP MATERIALIZED VIEW IF EXISTS pdm_boundary_tiles CASCADE;
			DROP MATERIALIZED VIEW IF EXISTS pdm_boundary_subdivide CASCADE;
			DROP MATERIALIZED VIEW IF EXISTS pdm_boundary CASCADE;
			DROP TABLE IF EXISTS pdm_boundary_osm CASCADE;
		""")

		for pid, pinfo in PROJECTS.items():
			cur.execute(SQL("""
				DROP VIEW IF EXISTS {vctf} CASCADE;
				DROP MATERIALIZED VIEW IF EXISTS {vct} CASCADE;
				DROP VIEW IF EXISTS {v2} CASCADE;
				DROP VIEW IF EXISTS {v1} CASCADE;
				DROP TABLE IF EXISTS {tc3} CASCADE;
				DROP TABLE IF EXISTS {tc2} CASCADE;
				DROP TABLE IF EXISTS {tc1} CASCADE;
				DROP TABLE IF EXISTS {t3} CASCADE;
				DROP TABLE IF EXISTS {t2} CASCADE;
				DROP TABLE IF EXISTS {t1} CASCADE;
			""").format(
				tc1=Identifier(f"pdm_project_{pinfo["short_id"]}_compare_point"),
				tc2=Identifier(f"pdm_project_{pinfo["short_id"]}_compare_linestring"),
				tc3=Identifier(f"pdm_project_{pinfo["short_id"]}_compare_polygon"),
				t1=Identifier(f"pdm_project_{pinfo["short_id"]}_point"),
				t2=Identifier(f"pdm_project_{pinfo["short_id"]}_linestring"),
				t3=Identifier(f"pdm_project_{pinfo["short_id"]}_polygon"),
				v1=Identifier(f"pdm_project_{pinfo["short_id"]}"),
				v2=Identifier(f"pdm_project_{pinfo["short_id"]}_compare"),
				vctf=Identifier(f"pdm_project_{pinfo["short_id"]}_compare_tiles_filtered"),
				vct=Identifier(f"pdm_project_{pinfo["short_id"]}_compare_tiles"),
			))
	
	# Common tables
	cur.execute("""
		DROP TABLE IF EXISTS pdm_user_names CASCADE;
		DROP TABLE IF EXISTS pdm_user_contribs CASCADE;
		DROP TABLE IF EXISTS pdm_user_badges CASCADE;
		DROP FUNCTION IF EXISTS pdm_get_badges CASCADE;
		DROP TABLE IF EXISTS pdm_feature_counts CASCADE;
		DROP TABLE IF EXISTS pdm_note_counts CASCADE;
		DROP VIEW IF EXISTS pdm_leaderboard CASCADE;
		DROP TABLE IF EXISTS pdm_compare_exclusions CASCADE;
		DROP TABLE IF EXISTS pdm_changes CASCADE;
		DROP TABLE IF EXISTS pdm_projects CASCADE;
		DROP TABLE IF EXISTS pdm_projects_points CASCADE;
		DROP TABLE IF EXISTS pdm_feature_counts_per_boundary CASCADE;
		DROP TABLE IF EXISTS pdm_features_boundary CASCADE;
	""")

	print("Done!")
