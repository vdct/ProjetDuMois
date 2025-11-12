# Queries

Here are a few queries to manipulate data associated to projects. These extend abilities of website with SQL client.

### Evaluate changes

Find features that get tags on a given version:

```sql
with lines_changes as (SELECT
    osmid,
    version,
    tags,
    lag(tags) OVER (PARTITION BY osmid ORDER BY version) AS tags_old,
    geom_len
  FROM pdm_features_lines_changes
  WHERE osmid LIKE 'w%' AND action != 'delete'
)
SELECT osmid, version, tags_old, tags, (not tags_old ? 'circuits' and tags ? 'circuits') as circuit_add
from lines_changes
where tags is not null and not tags_old ? 'circuits' and tags ? 'circuits'
```

Find features that get tags on a given version and on a given boundary

```sql
with lines_changes as (SELECT
    fc.osmid,
    fc.version,
    fc.tags,
    lag(tags) OVER (PARTITION BY fc.osmid ORDER BY fc.version) AS tags_old,
    fc.geom_len
  FROM pdm_features_lines_changes fc
  JOIN pdm_features_lines_boundary fb ON fb.osmid=fc.osmid AND fb.version=fc.version
  WHERE fc.osmid LIKE 'w%' AND fc.action != 'delete' AND fb.boundary=120027
)
SELECT osmid, version, tags_old, tags, (not tags_old ? 'circuits' and tags ? 'circuits') as circuit_add
from lines_changes
where tags is not null and not tags_old ? 'circuits' and tags ? 'circuits'
```