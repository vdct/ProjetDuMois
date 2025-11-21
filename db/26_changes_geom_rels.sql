-- Rebuild geometries of relations
\timing
with members as (
	SELECT
    osmid,
    version,
    ts as ts_start,
    LEAD(ts) OVER (PARTITION BY osmid ORDER BY version) AS ts_end,
    geom
    FROM :features_table
	WHERE action != 'delete'
), list as (
	select f.osmid osmid, f.version version, m.geom geom
	from :features_table f
	join :members_table fm ON fm.osmid=f.osmid AND fm.version=f.version
	join members m ON m.osmid=fm.memberid AND ((greatest(f.ts, :start_date) >= m.ts_start AND greatest(f.ts, :start_date) < m.ts_end) OR (greatest(f.ts, :start_date) >= m.ts_start AND m.ts_end IS NULL))
	where f.geom is null AND f.osmid like 'r%'
	order by f.osmid, f.version
), rels as (
	select osmid, version, st_setsrid(st_union(array_agg(geom)), 4326) as geom, bool_or(geom is null) as geom_incomplete
	from list
	group by osmid, version
	having NOT bool_or(geom is null)
)
update :features_table f set geom=rels.geom from rels where f.osmid=rels.osmid and f.version=rels.version;
