const CONFIG = require('../config.json');
const fs = require('fs');
const projects = require('../website/projects');
const { getProjectDays } = require('../website/utils');
const fetch = require('node-fetch').default;
const booleanContains = require('@turf/boolean-contains').default;

/*
 * Generates 31_projects_update_tmp.sh script
 * in order to update projects statistics and data daily
 */

// Constants
const CSV_NOTES = (project_slug) => `${CONFIG.WORK_DIR}/notes_${project_slug}.csv`;
const CSV_NOTES_CONTRIBS = (project_slug) => `${CONFIG.WORK_DIR}/user_notes_${project_slug}.csv`;
const CSV_NOTES_USERS = (project_slug) => `${CONFIG.WORK_DIR}/usernames_notes_${project_slug}.csv`;
const OUTPUT_SCRIPT_FS = __dirname+'/31_projects_update_tmp.sh';

const PSQL = `psql -d ${process.env.DB_URL}`;
const HAS_BOUNDARY = `${PSQL} -c "SELECT * FROM pdm_boundary LIMIT 1" > /dev/null 2>&1 `;

// Notes statistics
function processNotes(project) {
    const slug = project.name.split("_").pop();
    const days = getProjectDays(project);
    const today = new Date().toISOString().split("T")[0];
    const notesSources = project.datasources.filter(ds => ds.source === "notes");
    if(notesSources.length > 0) {
        const notesPerDay = {};
        const userNotes = [];
        const userNames = {};
        days.forEach(day => notesPerDay[day] = { open: 0, closed: 0 });

        // Review each note source
        const promises = notesSources.map((noteSource, nsid) => {
            // Call OSM API for each term
            const subpromises = noteSource.terms.map(term => {
                console.log(`Download notes (${slug}/${term}) from OSM server...`);
                return fetch(`${CONFIG.OSM_URL}/api/0.6/notes/search.json?q=${encodeURIComponent(term)}&limit=10000&closed=-1&from=${project.start_date}`)
                    .then(res => res.json())
                    .catch(e => {
                        console.error(`Failed to retrieve ${slug}/${term}:`, e);
                        return { features: [] };
                    });
            });

            // Process received notes
            const countedNotes = [];
            return Promise.all(subpromises).then(results => {
                results.forEach(result => {
                    result.features.forEach(f => {
                        if(!countedNotes.includes(f.properties.id)) {
                            countedNotes.push(f.properties.id);
                            if(booleanContains(CONFIG.GEOJSON_BOUNDS, f)) {
                                // Append note to count for each day it was opened
                                const start = f.properties.date_created.split(" ")[0];
                                const end = f.properties.closed_at ? f.properties.closed_at.split(" ")[0] : today;
                                days.forEach(day => {
                                    if(f.properties.status === "closed" && end <= day) {
                                        notesPerDay[day].closed++;
                                    }
                                    else if(start <= day && day <= end) {
                                        notesPerDay[day].open++;
                                    }
                                });

                                // Add as user contribution
                                if(f.properties.comments.length >= 1 && f.properties.comments[0].uid) {
                                    userNotes.push([
                                        project.id,
                                        f.properties.comments[0].uid,
                                        start,
                                        "note",
                                        (project.statistics && project.statistics.points && project.statistics.points.note) || 1
                                    ]);
                                    userNames[f.properties.comments[0].uid] = f.properties.comments[0].user;
                                }
                            }
                        }
                    });
                });
                return true;
            });
        });

        // Merge all statistics from all sources
        Promise.all(promises).then(() => {
            // Notes per day
            const csvText = Object.entries(notesPerDay).map(e => `${project.id},${e[0]},${e[1].open},${e[1].closed}`).join("\n");
            fs.writeFile(CSV_NOTES(slug), csvText, (err) => {
                if(err) { console.error(err); }
                else { console.log("Written note stats"); }
            });

            // User notes
            const csvUserNotes = userNotes.map(un => un.join(",")).join("\n");
            fs.writeFile(CSV_NOTES_CONTRIBS(slug), csvUserNotes, (err) => {
                if(err) { console.error(err); }
                else { console.log("Written user notes contributions"); }
            });

            // User names from notes
            const csvUserNames = Object.entries(userNames).map(e => `${e[0]},${e[1]}`).join("\n");
            fs.writeFile(CSV_NOTES_USERS(slug), csvUserNames, (err) => {
                if(err) { console.error(err); }
                else { console.log("Written user names from notes"); }
            });

            return true;
        });
    }

    return notesSources;
}

// Script text
const separator = `echo "-------------------------------------------------------------------"
echo ""`;

// Full script
var script = `#!/bin/bash

# Script for updating projects statistics
# Generated automatically by npm run projects:update

set -e
mode="$1"
if [[ -z "$mode" ]]; then
    mode="update"
fi

if [ ! -d "${CONFIG.WORK_DIR}" ]; then
    echo "== Create work directory"
    mkdir -p "${CONFIG.WORK_DIR}"
    ${separator}
fi

echo "== Prerequisites"
nbProjects=$(${PSQL} -tAc "select count(*) from pdm_projects" | sed 's/[^0-9]*//g' )
nbPoints=$(${PSQL} -tAc "select count(*) from pdm_projects_points" | sed 's/[^0-9]*//g' )
nbTeams=$(${PSQL} -tAc "select count(*) from pdm_projects_teams" | sed 's/[^0-9]*//g' )

if (( \$nbProjects < 1 )); then
    echo "WARN: No known projects in SQL projects table"
else
    echo "\$nbProjects projects known"
fi
if (( \$nbPoints < 1 )); then
    echo "WARN: No declared points for projects contributions"
else
    echo "\$nbPoints points known"
fi
if (( \$nbTeams < 1 )); then
    echo "INFO: No declared teams for projects contributions"
else
    echo "\$nbTeams team members known"
fi

${separator}


if ${HAS_BOUNDARY}; then
    echo "== Refresh boundaries"
    ${PSQL} -c "REFRESH MATERIALIZED VIEW pdm_boundary_subdivide"

    ${separator}
fi

if [[ "\$mode" = "init" ]]; then
    echo "== Initial counts for projects"
    process_start_t0=$(date -d now +%s)
    `;
    Object.values(projects).forEach(project => {
        if (project.statistics.count){
            script += `
                ${PSQL} -v project_id="${project.id}" -f "${__dirname}/34_projects_init.sql"
            `;
        }
    });
    script += `
    echo "[\$((\$(date -d now +%s) - \$process_start_t0))s] Init done. Continuing with counts"
    ${separator}
fi

current_ts=$(date -d now +"%Y-%m-%dT00:00:00Z" --utc)
current_time=$(date -d "\$current_ts" +%s --utc)
current_month=$(date -d "\$current_ts" +%-m --utc)
current_year=$(date -d "\$current_ts" +%Y --utc)
`;

Object.values(projects).forEach(project => {
    const slug = project.name.split("_").pop();
    script += `
IFS='|'
process_data=\$(${PSQL} -qtAc "SELECT to_char (COALESCE(counts_lastupdate_date, start_date) at time zone 'UTC', 'YYYY-MM-DD\\"T\\"00:00:00\\"Z\\"') as start, to_char (LEAST(end_date, CURRENT_TIMESTAMP) at time zone 'UTC', 'YYYY-MM-DD\\"T\\"00:00:00\\"Z\\"') as end from pdm_projects where project_id=${project.id}")
read -r -a process_qry <<< \$process_data
process_start_ts=\${process_qry[0]}
process_start_day=\$(date -d "\$process_start_ts" +%-d)
process_start_month=\$(date -d "\$process_start_ts" +%-m)
process_start_year=\$(date -d "\$process_start_ts" +%Y)
process_end_ts=\${process_qry[1]}
process_end_time=\$(date -d "\$process_end_ts" +%s)
process_end_day=\$(date -d "\$process_end_ts" +%-d)
process_end_month=\$(date -d "\$process_end_ts" +%-m)
process_end_year=\$(date -d "\$process_end_ts" +%Y)
echo "== Statistics for project ${project.name}" between \$process_start_ts and \$process_end_ts
process_start_t0=$(date -d now +%s)`;
    // Dénombrements
    if (project.statistics.count){
        script += `
if [[ \$process_start_ts == \$process_end_ts ]]; then
    echo "No date to count"
else
    echo "   => [\$((\$(date -d now +%s) - \$process_start_t0))s] Counting features"
    count_dates_list=""
    process_interm_time=\$(date -d "\${process_end_year}-\${process_end_month}-01T00:00:00Z" +%s --utc)
    if (( \$process_end_day <= 15 )); then
        process_interm_time=$((\$process_interm_time - 20*86400))
    fi
    process_interm_year=\$(date -d "@\$process_interm_time" +%Y)
    process_interm_month=\$(date -d "@\$process_interm_time" +%-m)
    if [[ "\$process_start_month" != "\$process_end_month" ]] || [[ "\$process_start_year" != "\$process_end_year" ]]; then
        for ((count_date_year=process_start_year; count_date_year<=process_interm_year; count_date_year++))
            do
            count_date_month=\$((count_date_year == process_start_year ? process_start_month : 1))
            count_date_month_end=\$((count_date_year == process_interm_year ? process_interm_month : 12))
            for((count_date_month=count_date_month; count_date_month<=count_date_month_end; count_date_month++))
                do
                count_date_current=\$(date -d "\${count_date_year}-\${count_date_month}-01" --utc +'%Y-%m-%dT00:00:00Z')
                count_dates_list="('\$count_date_current', '\$count_date_current'::timestamp - interval '1 month'),\$count_dates_list"
            done
        done
        process_interm_day="02"
    else
        process_interm_day=\$process_start_day
    fi
    process_interm_time=\$(date -d "\${process_interm_year}-\${process_interm_month}-\${process_interm_day}T00:00:00Z" +%s --utc)
    for((count_date_offset=process_interm_time; count_date_offset<process_end_time; count_date_offset+=86400))
        do
        count_date_current=\$(date -d "@\$count_date_offset" +'%Y-%m-%dT00:00:00Z')
        count_dates_list="('\$count_date_current', '\$count_date_current'::timestamp - interval '1 day'),\$count_dates_list"
    done
    count_dates_list="\$count_dates_list ('\$process_end_ts', '\$process_end_ts'::timestamp - interval '1 day')"

    ${PSQL} -v project_id="${project.id}" -v changes_table="pdm_features_${slug}_changes" -v boundary_table="pdm_features_${slug}_boundary" -v labels_table="pdm_features_${slug}_labels" -v start_date="'\${process_start_ts}'" -v end_date="'\${process_end_ts}'" -v dates_list="\$count_dates_list" -f "${__dirname}/32_projects_counts.sql"
        `;
    }

    script += `
    echo "   => [\$((\$(date -d now +%s) - \$process_start_t0))s] Generate user contributions"
    ${PSQL} -v project_id="${project.id}" -v features_table="pdm_features_${slug}" -v changes_table="pdm_features_${slug}_changes" -v boundary_table="pdm_features_${slug}_boundary" -v labels_table="pdm_features_${slug}_labels"  -v start_date="'\${process_start_ts}'" -v end_date="'\${process_end_ts}'" -v project_start_date="'${project.start_date}'" -v dates_list="\$count_dates_list" -f "${__dirname}/33_projects_contribs.sql"

    if [ -f '${__dirname}/../projects/${project.name}/extract.sh' ]; then
        echo "   => [\$((\$(date -d now +%s) - \$process_start_t0))s] Extract script"
        ${__dirname}/../projects/${project.name}/extract.sh
        echo ""
    fi
fi
    `;

    // Notes count (optional)
    let notesSources = processNotes(project);
    if (notesSources.length > 0){
        script += `
if [ -f "${CSV_NOTES(slug)}" ]; then
	echo "   => [\$((\$(date -d now +%s) - \$process_start_t0))s] Notes statistics"
	${PSQL} -c "DELETE FROM pdm_note_counts WHERE project_id=${project.id} AND ts BETWEEN '\${process_start_ts}' AND '\${current_ts}'"
	${PSQL} -c "\\COPY pdm_note_counts FROM '${CSV_NOTES(slug)}' CSV"
	${PSQL} -c "\\COPY pdm_user_contribs(project_id, userid, ts, contribution, points) FROM '${CSV_NOTES_CONTRIBS(slug)}' CSV"
	${PSQL} -c "CREATE TABLE pdm_user_names_notes(userid BIGINT, username VARCHAR)"
	${PSQL} -c "\\COPY pdm_user_names_notes FROM '${CSV_NOTES_USERS(slug)}' CSV"
	${PSQL} -c "INSERT INTO pdm_user_names SELECT userid, username FROM pdm_user_names_notes ON CONFLICT (userid) DO NOTHING; DROP TABLE pdm_user_names_notes;"
	rm -f "${CSV_NOTES(slug)}" "${CSV_NOTES_CONTRIBS(slug)}" "${CSV_NOTES_USERS(slug)}"
fi
`;
    }

    script += `
${PSQL} -c "UPDATE pdm_projects SET counts_lastupdate_date='\$process_end_ts' WHERE project_id=${project.id}"
echo "   => [\$((\$(date -d now +%s) - \$process_start_t0))s] Project update sucessful"
${separator}
`;
});

script += `
if ${HAS_BOUNDARY}; then
    echo "== Refresh boundary tiles"
    ${PSQL} -c "REFRESH MATERIALIZED VIEW pdm_boundary_tiles"
fi
${separator}
`;

fs.writeFile(OUTPUT_SCRIPT_FS, script, { mode: 0o766 }, err => {
    if(err) { throw new Error(err); }
    console.log("Written Bash script");
});
