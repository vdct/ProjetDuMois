DROP MATERIALIZED VIEW IF EXISTS :changes_table;
CREATE MATERIALIZED VIEW :changes_table as
    WITH changes as (SELECT
        osmid,
        version,
        changeset,
        ts as ts_start,
        LEAD(ts) OVER (PARTITION BY osmid ORDER BY version) AS ts_end,
        userid,
        tags,
        action,
        tagsfilter,
        lead (tagsfilter) over wbkwd as tagsfilter_bkwd,
        contrib,
        geom
        FROM :features_table
        )
    SELECT
        osmid,
        version,
        changeset,
        ts_start,
        ts_end,
        userid,
        tags,
        action,
        case
            when action='modify' and (tagsfilter_bkwd=false OR tagsfilter_bkwd is null) and tagsfilter=true then 'edit-in'
            when action='modify' and tagsfilter_bkwd=true and tagsfilter=false then 'edit-out'
            else contrib
        end as contrib,
        tagsfilter,
        geom,
        0 as geom_len,
        0 as geom_area,
        0 as geom_len_delta,
        0 as geom_area_delta
        FROM changes
        WHERE action != 'delete';
