-- Rebuild geometries of ways
\timing
with members as (
	select f.osmid osmid, f.version version, m.geom geom
	from :features_table f
	join :members_table fm ON fm.osmid=f.osmid AND fm.version=f.version
	join :features_table m ON m.osmid=fm.memberid
	where f.geom is null AND f.osmid like 'w%'
	order by fm.osmid, fm.version, fm.pos
), ways as (
	select osmid, version, st_makeline(array_agg(geom)) as geom 
	from members
	group by osmid, version
)
update :features_table f set geom=ways.geom from ways where f.osmid=ways.osmid and f.version=ways.version;
