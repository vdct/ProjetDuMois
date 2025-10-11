const CONFIG = require('../config.json');
const fs = require('fs');
const projects = require('../website/projects');
const {Pool} = require('pg')

/*
 * Generates 21_changes_update_tmp.sh script
 * in order to update projects statistics and data daily
 */

// Constants
const OPL2FTS_FS = __dirname+'/opl2features.awk';
const OSC_UPDATES_FS = CONFIG.WORK_DIR + '/changes.osc.gz';
const CSV_FEATURES_FS = CONFIG.WORK_DIR + '/features.csv';
const OSH_PBF_FS = CONFIG.WORK_DIR + '/' +  CONFIG.OSH_PBF_URL.split("/").pop().split(".").shift() + ".osh.pbf";
const OSH_TS_FS = CONFIG.WORK_DIR + '/' +  CONFIG.OSH_PBF_URL.split("/").pop().split(".").shift() + ".osh.ts";
const POLY_FS = CONFIG.WORK_DIR + '/' + OSH_PBF_FS.split("/").pop().split(".").shift() + ".poly";
const OUTPUT_SCRIPT_FS = __dirname+'/21_changes_update_tmp.sh';
const COOKIES_FS = CONFIG.WORK_DIR + '/cookie.txt';

const PSQL = `psql -d ${process.env.DB_URL}`;
const HAS_BOUNDARY = `${PSQL} -c "SELECT * FROM pdm_boundary LIMIT 1" > /dev/null 2>&1 `;

const pgPool = new Pool({
    connectionString: `${process.env.DB_URL}`
});

function macroChangesCsv (project, csvFeatures, csvMembers = null, start_ts = null, end_ts = null){
    const slug = project.name.split("_").pop();
    const features_table = `pdm_features_${slug}`;
    const members_table = `pdm_members_${slug}`;
    const changes_table = `pdm_features_${slug}_changes`;
    const boundary_table = `pdm_features_${slug}_boundary`;
    let work_table;
    let script = ``;

    if (start_ts == null && end_ts == null){
        work_table = features_table;
        script += `
        echo "   => Init changes table in database"
        ${PSQL} -v features_table="${work_table}" -v members_table="${members_table}" -v changes_table="${changes_table}" -v boundary_table="${boundary_table}" -f "${__dirname}/22_changes_init.sql"

        ${PSQL} -c "\\COPY ${work_table} (osmid, version, action, contrib, ts, userid, username, tags, geom, tagsfilter) FROM '${csvFeatures}' CSV"

        ${PSQL} -c "REFRESH MATERIALIZED VIEW ${changes_table}"
        `;
        if (csvMembers != null){
            script += `
            ${PSQL} -c "\\COPY ${members_table} (memberid, osmid, version, pos) FROM '${csvMembers}' CSV"
            `;
        }
    }else{
        work_table = `${features_table}_tmp`;
        script += `
        echo "   => Accumulate changes table in database"
        ${PSQL} -c "DELETE FROM ${features_table} WHERE ts BETWEEN '${start_ts}' AND '${end_ts}'"

        ${PSQL} -c "CREATE TABLE IF NOT EXISTS ${work_table} (LIKE ${features_table})"
        ${PSQL} -c "TRUNCATE TABLE ${work_table}"

        ${PSQL} -c "\\COPY ${work_table} (osmid, version, action, contrib, ts, userid, username, tags, geom, tagsfilter) FROM '${csvFeatures}' CSV"

        ${PSQL} -v features_table="${features_table}" -v features_table_tmp="${work_table}" -f "${__dirname}/23_changes_populate.sql"
        ${PSQL} -c "CREATE INDEX ON ${work_table} using gist(geom)"
        ${PSQL} -c "REFRESH MATERIALIZED VIEW ${changes_table}"
        `;

        if (csvMembers != null){
            script += `
            ${PSQL} -c "CREATE TABLE IF NOT EXISTS ${members_table}_tmp (LIKE ${members_table})"
            ${PSQL} -c "\\COPY ${members_table}_tmp (memberid, osmid, version, pos) FROM '${csvMembers}' CSV"

            ${PSQL} -v members_table="${members_table}" -v members_table_tmp="${members_table}_tmp" -f "${__dirname}/25_members_populate.sql"
            ${PSQL} -c "DROP TABLE ${members_table}_tmp"
            `;
        }
    }

    script += `
    if ${HAS_BOUNDARY}; then
        ${PSQL} -v features_table="${work_table}" -v boundary_table="${boundary_table}" -f "${__dirname}/24_changes_boundary.sql"
    fi

    if [ -f "${__dirname}/../projects/${project.name}/contribs.sql" ]; then
        echo "Including project custom contributions"
        ${PSQL} -f "${__dirname}/../projects/${project.name}/contribs.sql"
    fi
    `;

    if (start_ts != null && end_ts != null){
        script += `${PSQL} -c "DROP TABLE ${work_table}"
        `;
    }

    script += `
    rm -f "${csvFeatures}" "${csvMembers}"
    ${separator}
    `;

    return script;
}

// Projects installation
// Beware of async queries
console.log("Projects installation");

let projectsQry = "INSERT INTO pdm_projects (project_id, project, start_date, end_date) VALUES ";
let projectPointsQry = "INSERT INTO pdm_projects_points (project_id, contrib, points) VALUES ";
let projectPointsLength = 0;
let projectLength = 0;

Object.values(projects).forEach(project => {
    let project_end_date = project.end_date;
    if (project_end_date != null){
        project_end_date = `'${project_end_date}'`;
    }
    else {
        project_end_date = null;
    }
    projectsQry += `(${project.id}, '${project.name}', '${project.start_date}', ${project_end_date}),`;
    projectLength++;

    Object.entries(project.statistics.points).forEach(([contrib,value]) => {
        projectPointsQry += `(${project.id}, '${contrib}', ${value}),`;
        projectPointsLength++;
    });
});

projectsQry = `${projectsQry.substring(0, projectsQry.length-1)} ON CONFLICT (project_id) DO UPDATE SET start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date`;
pgPool.query(projectsQry, (err, res) => {
    if (err){
        throw new Error(`Erreur installation projets: ${err}`);
    }
    console.log(projectLength+" project(s) installed");
});

projectPointsQry = `${projectPointsQry.substring(0, projectPointsQry.length-1)} ON CONFLICT (project_id, contrib) DO UPDATE SET points=EXCLUDED.points`;
pgPool.query(projectPointsQry, (err, res) => {
    if (err){
        throw new Error(`Erreur installation points projet: ${err}`);
    }
    console.log(projectPointsLength+" project(s) point(s) installed");
});

// Script text
const separator = `echo "-------------------------------------------------------------------"
echo ""`;

// Full script
var script = `#!/bin/bash

# Script for updating current changes
# Generated automatically by npm run changes:update

set -e
mode="$1"
if [[ -z "$mode" ]]; then
    mode="update"
fi

echo "== Prerequisites"
if [ ! -d "${CONFIG.WORK_DIR}" ]; then
    echo "== Create work directory"
    mkdir -p "${CONFIG.WORK_DIR}"
fi

nbProjects=\$(${PSQL} -tAc "select count(*) from pdm_projects" | sed 's/[^0-9]*//g' )
nbPoints=\$(${PSQL} -tAc "select count(*) from pdm_projects_points" | sed 's/[^0-9]*//g' )

if (( \$nbProjects < 1 )); then
    echo "WARN: No known projects in SQL projects table"
    exit 3;
else
    echo "\$nbProjects projects known"
fi
if (( $nbPoints < 1 )); then
    echo "WARN: No declared points for projects contributions"
else
    echo "\$nbPoints points known"
fi
${separator}

current_ts=\$(date -d now +"%Y-%m-%dT%H:%M:%SZ" --utc)
current_time=\$(date -d now +%s --utc)

if [[ "\$mode" = "init" ]]; then
    echo "== Initial changes import from OSH"
    if [ ! -f "${OSH_PBF_FS}" ]; then
    `;
if (CONFIG.OSH_PBF_AUTHORIZED){
    script += `
        echo "== Get cookies for authorized download of OSH PBF file"
        python3 ${__dirname}/../lib/sendfile_osm_oauth_protector/oauth_cookie_client.py \\
            --osm-host ${CONFIG.OSM_URL} \\
            -u "${CONFIG.OSM_USER}" -p "${CONFIG.OSM_PASS}" \\
            -c ${CONFIG.OSH_PBF_URL.split("/").slice(0, 3).join("/")}/get_cookie \\
            -o "${COOKIES_FS}"
            `;
}
script += `
        echo "== Download OSH PBF file"
        wget --progress=dot:giga -N --no-cookies --header "Cookie: $(cat "${COOKIES_FS}" | cut -d ';' -f 1)" -P "${CONFIG.WORK_DIR}" -O "${OSH_PBF_FS}" "${CONFIG.OSH_PBF_URL}"
        rm -f "${COOKIES_FS}" "${OSH_TS_FS}"
    else
        echo "OSH file exists"
    fi

    if [ ! -f "${OSH_TS_FS}" ]; then
        echo "== Read OSH file information..."
        osh_ts=\$(osmium fileinfo -e -g data.timestamp.last "${OSH_PBF_FS}")
        echo \$osh_ts > "${OSH_TS_FS}"
    else
        osh_ts=\$(cat "${OSH_TS_FS}")
    fi
    `;

    if (CONFIG.POLY_URL != null){
        script += `
    if [ ! -f "${POLY_FS}" ]; then
        wget -N --no-cookies -P "${CONFIG.WORK_DIR}" -O "${POLY_FS}" "${CONFIG.POLY_URL}"
    else
        echo "Polygon file exists"
    fi
    `;
    }else{
        script += `
        echo "No polygon file to filter on"
        `;
    }

    script += `
    echo "OSH file is up to \$osh_ts"
    osh_time=\$(date -d "\$osh_ts" +%s --utc)
    ${separator}

    `;
Object.values(projects).forEach(project => {
    // Project files
    const slug = project.name.split("_").pop();
    const oshProjectTags = OSH_PBF_FS.replace(".osh", `.${slug}_tags.osh`);
    const oshProjectInterm = OSH_PBF_FS.replace(".osh", `.${slug}_interm.osh`);
    const oplProject = OSC_UPDATES_FS.replace("changes.osc.gz", `changes-${slug}.opl`);
    const csvFeatures = CSV_FEATURES_FS.replace("features", `features-${slug}`);
    const csvMembers = CSV_FEATURES_FS.replace("features", `members-${slug}`);

    let tagFilterParts = project.database.osmium_tag_filter.split("&");

    script += `
    echo "== Begin process for project ${project.name}"
    process_start_t0=$(date -d now +%s)
    IFS='|'
    process_data=\$(${PSQL} -qtAc "select to_char(start_date,'YYYY-MM-DD\\"T\\"HH24:MI:SS\\"Z\\"') as start_date, to_char(end_date, 'YYYY-MM-DD\\"T\\"HH24:MI:SS\\"Z\\"') as end_date, to_char(changes_lastupdate_date, 'YYYY-MM-DD\\"T\\"HH24:MI:SS\\"Z\\"') as changes_lastupdate_date from pdm_projects where project_id=${project.id}")
    read -r -a process_qry <<< \$process_data
    process_start_ts=\${process_qry[0]}
    process_start_time=\$(date -d "\$process_start_ts" +%s)
    project_end_ts=\${process_qry[1]}
    project_end_time=\$(date -d "\$project_end_ts" +%s)
    process_end_ts=\$osh_ts
    process_end_time=\$osh_time
    project_lastupdate_ts=\${process_qry[2]}

    if [[ \$current_time < \$process_start_time ]]; then
        echo "Project ${project.name} begins in future and can't be inited"
    elif [[ ! -z \$project_lastupdate_ts ]]; then
        echo "Project ${project.name} is already inited up to \$project_lastupdate_ts. Remove changes_lastupdate_date and rerun."
    else
        if [[ ! -z $project_end_time && \$osh_time > \$project_end_time ]]; then
            echo "Project ends before OSH time"
            process_end_ts=\$(date -d "@\$project_end_time" +"%Y-%m-%dT00:00:00Z")
        fi

        history_src="${OSH_PBF_FS}"
        history_start=\$(date -d "$process_start_ts" +"%Y%m%d")
        history_end=\$(date -d "$process_end_ts" +"%Y%m%d")
        history_osh="\${history_src/.osh/".time-\$history_start-\$history_end.osh"}"
        if [[ ! -f "\$history_osh" ]]; then
            echo "   => Extract history between \$process_start_ts and \$process_end_ts"
            osmium time-filter "\$history_src" \$process_start_ts \$process_end_ts -o "\$history_osh"
        else
            echo "   => Reuse existing history between \$process_start_ts and \$process_end_ts"
        fi

        `;
        let oshProjectTime = "\$history_osh";
        let getIdOptions = "-H";
        let tagFilterFeatures = "nwr";
        tagFilterParts.forEach(tagFilter => {
            if (tagFilter.indexOf('/') > -1){
                tagFilterFeatures = (tagFilterFeatures.match(new RegExp('[' + tagFilter.split('/').shift() + ']', 'g')) || []).join('');
            }
            script += `
        echo "   => Extract features from OSH (${tagFilter})"
        rm -f "${oshProjectInterm}"
        osmium tags-filter "${oshProjectTime}" -R ${tagFilter} -o "${oshProjectInterm}"
        rm -f "${oshProjectTags}"
        mv "${oshProjectInterm}" "${oshProjectTags}"
        `;
            oshProjectTime = oshProjectTags;
        });

        if (tagFilterFeatures.indexOf("w") > -1 || tagFilterFeatures.indexOf("r") > -1){
            getIdOptions += " -r -t";
        }

        script += `
        echo "   => Seek for all changes related to selected features and convert to OPL"
        rm -f "${oplProject}"
        osmium getid ${getIdOptions} "\$history_osh" -I "${oshProjectTags}" -f opl,history=true -o "${oplProject}"

        echo "   => Transform changes into CSV file"
        rm -f "${csvFeatures}" "${csvMembers}" "${oshProjectTags}"
        awk -f ${OPL2FTS_FS} -v tagfilter="${project.database.osmium_tag_filter}" -v output_main="${csvFeatures}" -v output_members="${csvMembers}" "${oplProject}"
        rm -f "${oplProject}"

        ${macroChangesCsv (project, csvFeatures, csvMembers)}

        ${PSQL} -c "UPDATE pdm_projects SET changes_lastupdate_date='\${process_end_ts}', counts_lastupdate_date=NULL WHERE project_id=${project.id}"
        process_duration=\$((\$(date -d now +%s) - \$process_start_t0))
        echo "== Project ${project.name} successfully initied in \$process_duration seconds"
        ${separator} 
    fi
    `;
});

script += `
    echo "== Removing temp files"
    rm -f "${CONFIG.WORK_DIR}/*.osh.pbf"
${separator}
fi

echo "== Look for earliest date to process"
IFS='|'
process_data=\$(${PSQL} -qtAc "with update_days as (select project, COALESCE(changes_lastupdate_date, start_date) as start_date, CURRENT_TIMESTAMP as end_date, extract (day from (CURRENT_TIMESTAMP - COALESCE(changes_lastupdate_date, start_date))) as days from pdm_projects) select to_char(MIN(start_date),'YYYY-MM-DD\\"T\\"HH24:MI:SS\\"Z\\"') as start_date, to_char(MAX(end_date),'YYYY-MM-DD\\"T\\"HH24:MI:SS\\"Z\\"') as end_date, extract (day from (MAX(end_date) - MIN(start_date))) as delta from update_days where days between 0 and 30;")
read -r -a process_qry <<< \$process_data
process_start_ts=\${process_qry[0]}
process_start_time=\$(date -d "\$process_start_ts" +%s)
process_end_ts=\${process_qry[1]}
process_delta=\${process_qry[2]}

if (( \$process_delta < 1 )); then
    echo "Nothing is suitable to update. Projects older than 30 days should be inited again."
else
    echo "Start processing from: \$process_start_ts to \$process_end_ts"
    
    changes_src="${OSC_UPDATES_FS}"
    changes_start=\$(date -d "$process_start_ts" +"%Y%m%d")
    changes_end=\$(date -d "$process_end_ts" +"%Y%m%d")
    changes_osc="\${changes_src/.osc.gz/".time-\$changes_start-\$changes_end.osc.gz"}"
    changes_oscts="\${changes_src/.osc.gz/".time-\$changes_start-\$changes_end.osc.ts"}"
    if [[ ! -f \$changes_osc ]]; then
        echo "== Build OSC changes with replication files"
        osmupdate --keep-tempfiles --day -t="${CONFIG.WORK_DIR}/osmupdate/" -v \$process_start_ts "\$changes_osc"

        echo "== Read OSC file information..."
        osc_ts=\$(osmium fileinfo -e -g data.timestamp.last "\$changes_osc")
        echo \$osc_ts > "\$changes_oscts"
        osc_time=\$(date -d "\$osc_ts" +%s)
        echo "OSC file is up to \$osc_ts"
        `;
    
    if (CONFIG.POLY_URL != null){
            script += `
        if [ -f ${POLY_FS} ]; then
            echo "== Extract data in polygon..."
            osmium extract -p "${POLY_FS}" --with-history -s complete_ways "\$changes_osc" -O -o "${OSC_UPDATES_FS}"
        else
            echo "== No polygon data to restrict on"
        fi
        `;
    }else{
            script += `
        echo "== No polygon data to restrict on"
        `;
    }

    script += `
    else
        echo "== Reuse existing OSC file"
        osc_ts=\$(cat "\$changes_oscts")
        echo "OSC file is up to \$osc_ts"
    fi
    ${separator}
    `;

Object.values(projects).forEach(project => {
    const slug = project.name.split("_").pop();
    const oscProject = OSC_UPDATES_FS.replace("changes", `changes.${slug}`);
    const oscProjectInterm = OSC_UPDATES_FS.replace("changes", `changes.${slug}_interm`);
    const oscProjectTags = OSC_UPDATES_FS.replace("changes", `changes.${slug}_tags`);
    const oscProjectIds = OSC_UPDATES_FS.replace("changes", `changes.${slug}_ids`);
    const oplProject = OSC_UPDATES_FS.replace("changes.osc.gz", `changes.${slug}.opl`);
    const csvFeatures = CSV_FEATURES_FS.replace("features", `features-${slug}`);
    const csvMembers = CSV_FEATURES_FS.replace("features", `members-${slug}`);
    const listKnownIds = CONFIG.WORK_DIR+'/ids-known.list'
    const listCreatedIds = CONFIG.WORK_DIR+'/ids-created.list'

    let tagFilterParts = project.database.osmium_tag_filter.split("&");

    script += `
    echo "== Begin process for project ${project.name}"
    process_start_t0=$(date -d now +%s)
    project_start_ts=\$(${PSQL} -qtAc "SELECT to_char (coalesce(changes_lastupdate_date, start_date) at time zone 'UTC', 'YYYY-MM-DD\\"T\\"HH24:MI:SS\\"Z\\"') from pdm_projects where project_id=${project.id}")
    project_start_time=\$(date -d "\$project_start_ts" +%s)
    project_end_ts=\$(${PSQL} -qtAc "SELECT to_char (end_date at time zone 'UTC', 'YYYY-MM-DD\\"T\\"HH24:MI:SS\\"Z\\"') from pdm_projects where project_id=${project.id}")
    project_end_time=\$(date -d "\$project_end_ts" +%s)
    if [[ -z \$project_end_ts ]]; then
        project_end_time=0
    fi

    if (( \$project_end_time > 0 && \$process_start_time > \$project_end_time )); then
        echo "Project ${project.name} is over and won't be updated"
    elif (( \$project_start_time < \$process_start_time )); then
        echo "Project ${project.name} is too old and should be inited with a fresh OSH again"
    else
        
        projectChanges_src="$changes_osc"
        if (( \$project_end_time > 0 && \$project_end_time < \$osc_time )); then
            projectChanges_start=\$(date -d "$project_start_ts" +"%Y%m%d")
            projectChanges_end=\$(date -d "$project_end_ts" +"%Y%m%d")
            projectChanges_osc="\${projectChanges_src/.osc.gz/".time-\$projectChanges_start-\$projectChanges_end.osc.gz"}"

            if [[ ! -f \$projectChanges_osc ]]; then
                echo "Time filter OSC file between \$project_start_ts to \$project_end_ts"
                osmium time-filter "\$projectChanges_src" -o "\$projectChanges_osc" \$project_start_ts \$project_end_ts
            else
                echo "Reuse existing time-filtered OSC file"
            fi
        else
            project_end_ts=\$osc_ts
        fi
        
        echo "Updating project changes from \$project_start_ts to \$project_end_ts"

        ${separator}
    `;

    let getIdOptions = "-H";
    let tagFilterFeatures = "nwr";
    let oscProjectUpdate = "\$projectChanges_osc";
    tagFilterParts.forEach(tagFilter => {
        if (tagFilter.indexOf('/') > -1){
            tagFilterFeatures = (tagFilterFeatures.match(new RegExp('[' + tagFilter.split('/').shift() + ']', 'g')) || []).join('');
        }
        script += `
        echo "   => Extract features from OSH (${tagFilter})"
        rm -f "${oscProjectInterm}"
        osmium tags-filter "${oscProjectUpdate}" -R ${tagFilter} -o "${oscProjectInterm}"
        rm -f "${oscProjectTags}"
        mv "${oscProjectInterm}" "${oscProjectTags}"
        `;
            oscProjectUpdate = oscProjectTags;
    });
    script += `
        osmium cat "${oscProjectTags}" -f opl | grep ' v1 ' | awk '{print $1}' > "${listCreatedIds}"
        `;

    if (tagFilterFeatures.indexOf("w") > -1 || tagFilterFeatures.indexOf("r") > -1){
        getIdOptions += " -r -t";
    }

    script += `
        ${PSQL} -qtAc "select regexp_replace(osmid, 'ode/|ay/|elation/', '') as osmid from pdm_features_${slug} group by osmid having NOT ('delete' = ANY (array_agg(action)))" > ${listKnownIds}
        knownFeatures=$(wc -l ${listKnownIds} | awk '{print $1}')
        createdFeatures=$(wc -l ${listCreatedIds} | awk '{print $1}')
        echo "   => Extract \$knownFeatures known features and \$createdFeatures created features by their ids"
        rm -f "${oplProject}"
        if [[ \$knownfeatures > 0 ]] || [[ \$createdFeatures > 0 ]]; then
            rm -f "${oscProjectIds}"
            osmium getid ${getIdOptions} -i "${listKnownIds}" -i "${listCreatedIds}" "\$projectChanges_osc" -o "${oscProjectIds}"

            echo "   => Merging changes in one file"
            osmium merge ${oscProjectTags} ${oscProjectIds} -f opl,history=true -o "${oplProject}"
            rm -f "${oscProjectTags}" "${oscProjectIds}"
        else
            echo "   => Transform to OPL"
            osmium cat "${oscProjectTags}" -f opl,history=true -o "${oplProject}"
            rm -f "${oscProjectTags}"
        fi

        echo "   => Transform changes into CSV file"
        rm -f "${CSV_FEATURES_FS}" "${listKnownIds}" "${listCreatedIds}"
        awk -f ${OPL2FTS_FS} -v tagfiler="${project.database.osmium_tag_filter}" -v output_main="${csvFeatures}" èv output_members="${csvMembers}" "${oplProject}"
        rm -f "${oplProject}"

        ${macroChangesCsv (project, csvFeatures, csvMembers, "\$project_start_ts", "\$project_end_ts")}

        ${PSQL} -c "UPDATE pdm_projects SET changes_lastupdate_date='\${project_end_ts}' WHERE project_id=${project.id}"
        process_duration=\$((\$(date -d now +%s) - \$process_start_t0))
        echo "   => Project update successful in \$process_duration seconds"
        ${separator}
    fi
    `;
});

script += `
    echo "== Removing temp files"
    rm -f "${CONFIG.WORK_DIR}/*.osc.*"
fi
`;

fs.writeFile(OUTPUT_SCRIPT_FS, script, { mode: 0o766 }, err => {
    if(err) { throw new Error(err); }
    console.log("Written Bash script");
});
