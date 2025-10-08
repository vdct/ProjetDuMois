const CONFIG = require('../config.json');
const fs = require('fs');
const projects = require('../website/projects');
const {Pool} = require('pg')

/*
 * Generates 21_changes_update_tmp.sh script
 * in order to update projects statistics and data daily
 */

// Constants
const OSC2FTS_FS = __dirname+'/osc2features.awk';
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

function macroChangesCsv (project, csv_file, start_ts = null, end_ts = null){
    const slug = project.name.split("_").pop();
    const features_table = `pdm_features_${slug}`;
    const changes_table = `pdm_features_${slug}_changes`;
    const boundary_table = `pdm_features_${slug}_boundary`;
    let script = `
    echo "   => Init changes table in database"
    `;
    if (start_ts != null && end_ts != null){
        script += `${PSQL} -c "DELETE FROM ${features_table} WHERE ts BETWEEN '${start_ts}' AND '${end_ts}'"`;
    }else{
        script += `${PSQL} -v features_table="${features_table}" -v changes_table="${changes_table}" -v boundary_table="${boundary_table}" -f "${__dirname}/22_changes_init.sql"
        `;
    }
    script += `

    ${PSQL} -c "CREATE TABLE IF NOT EXISTS ${features_table}_tmp (LIKE ${features_table})"
    ${PSQL} -c "TRUNCATE TABLE ${features_table}_tmp"

    ${PSQL} -c "\\COPY ${features_table}_tmp (osmid, version, action, contrib, ts, userid, username, tags, geom, tagsfilter) FROM '${csv_file}' CSV"

    ${PSQL} -v features_table="${features_table}" -v changes_table="${changes_table}" -v features_table_tmp="${features_table}_tmp" -f "${__dirname}/23_changes_populate.sql"
    if ${HAS_BOUNDARY}; then
        ${PSQL} -v features_table_tmp="${features_table}_tmp" -v boundary_table="${boundary_table}" -f "${__dirname}/24_changes_boundary.sql"
    fi
    ${PSQL} -c "DROP TABLE ${features_table}_tmp"

    if [ -f "${__dirname}/../projects/${project.name}/contribs.sql" ]; then
        echo "Including project custom contributions"
        ${PSQL} -f "${__dirname}/../projects/${project.name}/contribs.sql"
    fi

    rm -f "${csv_file}"
    ${separator}`;

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
    const oshProjectFiltered = OSH_PBF_FS.replace(".osh", `.${slug}_filtered.osh`);
    const oshProjectInterm = OSH_PBF_FS.replace(".osh", `.${slug}_interm.osh`);
    const oshProjectUseful = OSH_PBF_FS.replace(".osh", `.${slug}_useful.osh`);
    const oplProject = OSC_UPDATES_FS.replace("changes.osc.gz", `changes-${slug}.opl`);
    const csvFeatures = CSV_FEATURES_FS.replace("features", `features-${slug}`);

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

        history_start=\$(date -d "$process_start_ts" +"%Y%m%d")
        history_end=\$(date -d "$process_end_ts" +"%Y%m%d")
        history_osh="\${${OSH_PBF_FS}/.osh/"time-\$history_start-\$history_end"}
        if [[ ! -f "\$history_osh" ]]; then
            echo "   => Extract history between \$process_start_ts and \$process_end_ts"
            rm -f "${oshProjectTime}"
            osmium time-filter "${OSH_PBF_FS}" \$process_start_ts \$process_end_ts -o "\$history_osh"
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
        osmium tags-filter "${oshProjectTime}" -R ${tagFilter} -O -o "${oshProjectInterm}"
        rm -f "${oshProjectFiltered}"
        mv "${oshProjectInterm}" "${oshProjectFiltered}"
        `;
            oshProjectTime = oshProjectFiltered;
        });

        if (tagFilterFeatures.indexOf("w") > -1 || tagFilterFeatures.indexOf("r") > -1){
            getIdOptions += " -r -t";
        }

        script += `
        echo "   => Seek for all changes related to selected features"
        rm -f "${oshProjectUseful}"
        osmium getid ${getIdOptions} "${oshProjectTime}" -I "${oshProjectFiltered}" -o "${oshProjectUseful}"

        echo "   => Convert to OPL changes"
        rm -f "${oplProject}"
        osmium cat "${oshProjectUseful}" -f opl,history=true -o "${oplProject}"

        echo "   => Transform changes into CSV file"
        rm -f "${csvFeatures}" "${oshProjectTime}" "${oshProjectFiltered}" "${oshProjectUseful}"
        awk -f ${OSC2FTS_FS} -v tagfilter="${project.database.osmium_tag_filter}" "${oplProject}" > "${csvFeatures}"
        rm -f "${oplProject}"

        ${macroChangesCsv (project, csvFeatures)}

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

    echo "== Build OSC changes with replication files"
    osmupdate --keep-tempfiles --day -t="${CONFIG.WORK_DIR}/osmupdate/" -v \$process_start_ts "${CONFIG.WORK_DIR}/world.osc.gz"
    rm -f "${OSC_UPDATES_FS}"

    echo "== Read OSC file information..."
    osc_ts=\$(osmium fileinfo -e -g data.timestamp.last "${CONFIG.WORK_DIR}/world.osc.gz")
    osc_time=\$(date -d "\$osc_ts" +%s)
    echo "OSC file is up to \$osc_ts"`;

    if (CONFIG.POLY_URL != null){
        script += `
    if [ -f ${POLY_FS} ]; then
        echo "== Extract data in polygon..."
        osmium extract -p "${POLY_FS}" --with-history -s complete_ways "${CONFIG.WORK_DIR}/world.osc.gz" -O -o "${OSC_UPDATES_FS}"

        echo "== Remove temp files"
        rm -f "${CONFIG.WORK_DIR}/world.osc.gz"
    else
        echo "== No polygon data to restrict on"
        mv ${CONFIG.WORK_DIR}/world.osc.gz ${OSC_UPDATES_FS}
    fi
    `;
    }else{
        script += `
    echo "== No polygon data to restrict on"
    mv ${CONFIG.WORK_DIR}/world.osc.gz ${OSC_UPDATES_FS}
    `;
    }
    script += `
    ${separator}
    `;

Object.values(projects).forEach(project => {
    const slug = project.name.split("_").pop();
    const oscProject = OSC_UPDATES_FS.replace("changes", `changes-${slug}`);
    const oscProjectTags = OSC_UPDATES_FS.replace("changes", `changes-${slug}.tags`);
    const oscProjectIds = OSC_UPDATES_FS.replace("changes", `changes-${slug}.ids`);
    const oplProject = OSC_UPDATES_FS.replace("changes.osc.gz", `changes-${slug}.opl`);
    const csvFeatures = CSV_FEATURES_FS.replace("features", `features-${slug}`);
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
        if [ -f "${oscProject}" ]; then
            echo "Remove existing OSC filtered file for this project"
            rm -f "${oscProject}"
        fi

        if (( \$project_end_time > 0 && \$project_end_time < \$osc_time )); then
            echo "Time filter OSC file..."
            osmium time-filter "${OSC_UPDATES_FS}" -o "${oscProject}" \$project_start_ts \$project_end_ts 
        else
            project_end_ts=\$osc_ts
            cp ${OSC_UPDATES_FS} ${oscProject}
        fi
    
        echo "Updating project changes from \$project_start_ts to \$project_end_ts"
        ${separator}
    `;

    let getIdOptions = "-H";
    let tagFilterFeatures = "nwr";
    tagFilterParts.forEach(tagFilter => {
        if (tagFilter.indexOf('/') > -1){
            tagFilterFeatures = (tagFilterFeatures.match(new RegExp('[' + tagFilter.split('/').shift() + ']', 'g')) || []).join('');
        }
        script += `
        echo "   => Extract features from OSC (${tagFilter})"
        rm -f "${oscProjectTags}"
        osmium tags-filter "${oscProject}" ${tagFilter} -o "${oscProjectTags}"
        osmium cat "${oscProjectTags}" -f opl | grep ' v1 ' | awk '{print $1}' > "${listCreatedIds}"
        `;
    });
    if (tagFilterFeatures.indexOf("w") > -1 || tagFilterFeatures.indexOf("r") > -1){
        getIdOptions += " -r -t";
    }

    script += `
        ${PSQL} -qtAc "select regexp_replace(osmid, 'ode/|ay/|elation/', '') as osmid from pdm_features where project_id=${project.id} group by osmid having NOT ('delete' = ANY (array_agg(action)))" > ${listKnownIds}
        knownFeatures=$(wc -l ${listKnownIds} | awk '{print $1}')
        createdFeatures=$(wc -l ${listCreatedIds} | awk '{print $1}')
        echo "   => Extract \$knownFeatures known features and \$createdFeatures created features by their ids"
        rm -f "${oplProject}"
        if [[ \$knownfeatures > 0 ]] || [[ \$createdFeatures > 0 ]]; then
            rm -f "${oscProjectIds}"
            osmium getid ${getIdOptions} -i "${listKnownIds}" -i "${listCreatedIds}" "${oscProject}" -o "${oscProjectIds}"

            echo "   => Merging changes in one file"
            osmium merge ${oscProjectTags} ${oscProjectIds} -f opl,history=true,locations_on_ways=true -o "${oplProject}"
            rm -f "${oscProjectTags}" "${oscProjectIds}"
        else
            echo "   => Transform to OPL"
            osmium cat "${oscProjectTags}" -f opl,history=true,locations_on_ways=true -o "${oplProject}"
            rm -f "${oscProjectTags}"
        fi

        echo "   => Transform changes into CSV file"
        rm -f "${CSV_FEATURES_FS}" "${listKnownIds}" "${listCreatedIds}" "${oscProject}"
        awk -f ${OSC2FTS_FS} -v tagfiler="${project.database.osmium_tag_filter}" "${oplProject}" > "${csvFeatures}"
        rm -f "${oplProject}"

        ${macroChangesCsv (project, csvFeatures, "\$project_start_ts", "\$project_end_ts")}

        ${PSQL} -c "UPDATE pdm_projects SET changes_lastupdate_date='\${project_end_ts}' WHERE project_id=${project.id}"
        process_duration=\$((\$(date -d now +%s) - \$process_start_t0))
        echo "   => Project update successful in \$process_duration seconds"
        ${separator}
    fi
    `;
});

script += `
    rm -f "${OSC_UPDATES_FS}"
fi
`;

fs.writeFile(OUTPUT_SCRIPT_FS, script, { mode: 0o766 }, err => {
    if(err) { throw new Error(err); }
    console.log("Written Bash script");
});
