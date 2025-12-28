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
        geom,
        lead(geom) OVER wbkwd as geom_bkwd
        FROM :features_table
        WINDOW wbkwd AS (PARTITION BY osmid ORDER BY version desc)
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
        case
            when geom is not null and ST_IsClosed(geom) and St_geometrytype(geom) != 'ST_Point' then ST_buildarea(geom)
            else geom
        end as geom,
        case
            when geom is not null then St_Length(geom::geography)
            else 0
        end as geom_len,
        case
            when geom is not null and ST_IsClosed(geom) and St_geometrytype(geom) != 'ST_Point' then St_Area(ST_buildarea(geom)::geography)
            else 0
        end as geom_area,
        case
            when geom_bkwd is null AND geom is not null then St_Length(geom::geography)
            when geom_bkwd is not null and geom is not null then St_Length(geom::geography) - St_Length(geom_bkwd::geography)
            when geom_bkwd is not null and geom is null then -St_Length(geom_bkwd::geography)
            else 0
        end as geom_len_delta,
        case
            when geom is not null and ST_IsClosed(geom) and St_geometrytype(geom) != 'ST_Point' then
                case
                when geom_bkwd is not null and ST_IsClosed(geom_bkwd) and St_geometrytype(geom_bkwd) != 'ST_Point' then St_Area(ST_buildarea(geom)::geography) - St_Area(ST_buildarea(geom_bkwd)::geography)
                WHEN geom_bkwd is null OR ST_IsClosed(geom_bkwd)=FALSE OR St_geometrytype(geom_bkwd) = 'ST_Point' then St_Area(ST_buildarea(geom)::geography)
                end
            when geom is null or ST_IsClosed(geom)=FALSE or St_geometrytype(geom) = 'ST_Point' then
                case
                when geom_bkwd is not null and ST_IsClosed(geom_bkwd) and St_geometrytype(geom_bkwd) != 'ST_Point' then -St_Area(ST_buildarea(geom_bkwd)::geography)
                end
            else 0
        end as geom_area_delta
        FROM changes
        WHERE action != 'delete';
