-- Rebuild geometries of ways
\timing
with nodes as (
	SELECT
    osmid,
    version,
    ts as ts_start,
    LEAD(ts) OVER (PARTITION BY osmid ORDER BY version) AS ts_end,
    geom
    FROM :features_perm_table
	WHERE osmid like 'n%' and action != 'delete'
), list as (
	select f.osmid osmid, f.version version, n.geom geom
	from :features_table f
	join :members_table fm ON fm.osmid=f.osmid AND fm.version=f.version
	join nodes n ON n.osmid=fm.memberid AND ((greatest(f.ts, :start_date) >= n.ts_start AND greatest(f.ts, :start_date) < n.ts_end) OR (greatest(f.ts, :start_date) >= n.ts_start AND n.ts_end IS NULL))
	where f.geom is null AND f.osmid like 'w%'
	order by fm.osmid, fm.version, fm.pos
), ways as (
	select osmid, version, st_makeline(array_agg(geom)) as geom 
	from list
	group by osmid, version
)
update :features_perm_table f set geom=ways.geom from ways where f.osmid=ways.osmid and f.version=ways.version;
