-- Insert unknown members in table
WITH features as (
  select osmid, version from :features_table
  union
  select osmid, version from :features_table_update
), unknown as (
  select distinct m.memberid
  from :members_table m 
  left join features f ON f.osmid=m.memberid
  where f.version is null
) 

select 
  case when count(distinct case when memberid like 'node%' then memberid end) > 0 then concat('node(id:', array_to_string(array_agg(distinct case when memberid like 'node%' then replace(memberid, 'node/','') end), ','),');') end as nodes,
  case when count(distinct case when memberid like 'way%' then memberid end) > 0 then concat('way(id:', array_to_string(array_agg(distinct case when memberid like 'way%' then replace(memberid, 'way/','') end), ','),');') end as ways,
  case when count(distinct case when memberid like 'relation%' then memberid end) > 0 then concat('relation(id:', array_to_string(array_agg(distinct case when memberid like 'relation%' then replace(memberid, 'relation/','') end), ','),');') end as relation
from unknown;
