const CONFIG = require('../config.json');
const fs = require('fs');
const projects = require('../website/projects');
const { filterProjects } = require('../website/utils');
const fetch = require('node-fetch');
const booleanContains = require('@turf/boolean-contains').default;

/*
 * Generates 09_project_update_tmp.sh script
 * in order to update project statistics and data daily
 */

// Constants
let project = filterProjects(projects).current;

const OSH_DOWNLOADED = CONFIG.WORK_DIR + '/' + CONFIG.OSH_PBF_URL.split("/").pop();
const OSH_UPDATED = CONFIG.WORK_DIR + '/' + CONFIG.OSH_PBF_URL.split("/").pop().replace(".osh.pbf", ".latest.osh.pbf");
const OSM_PBF_NOW = CONFIG.WORK_DIR + '/' + CONFIG.OSH_PBF_URL.split("/").pop().replace(".osh.pbf", ".osm.pbf");
const OSH_POLY = OSH_DOWNLOADED.replace("-internal.osh.pbf", ".poly");
const OSH_USEFULL_IDS = CONFIG.WORK_DIR + '/usefull_ids.osh.pbf';
const OSH_USEFULL = CONFIG.WORK_DIR + '/usefull.osh.pbf';
const IMPOSM_ENABLED = CONFIG.DB_USE_IMPOSM_UPDATE;

const OSC2CSV = __dirname+'/osc2csv.xslt';
const OSC_USEFULL = CONFIG.WORK_DIR + '/extract_filtered.osc.gz';
const OSC_UPDATES = CONFIG.WORK_DIR + '/changes.osc.gz';
const OSC_UPDATES_LOCAL = CONFIG.WORK_DIR + '/changes.local.osc.gz';

const CSV_COUNT = CONFIG.WORK_DIR + '/count.csv';
const CSV_CHANGES = CONFIG.WORK_DIR + '/change.csv';
const CSV_NOTES = CONFIG.WORK_DIR + '/notes.csv';
const CSV_NOTES_CONTRIBS = CONFIG.WORK_DIR + '/user_notes.csv';
const CSV_NOTES_USERS = CONFIG.WORK_DIR + '/usernames_notes.csv';

const COOKIES = CONFIG.WORK_DIR + '/cookie.txt';
const PSQL = `psql "postgres://@${CONFIG.DB_HOST}:${CONFIG.DB_PORT}/${CONFIG.DB_NAME}"`;
const OUTPUT_SCRIPT = __dirname+'/09_project_update_tmp.sh';
const OUTPUT_SQL_POINTS = __dirname+'/13_points.sql';


// Check if there is any project to analyse
const projectIdFromCli = process.argv.slice(2).pop();
if(projectIdFromCli) {
	if(projects[projectIdFromCli]) {
		project = projects[projectIdFromCli];
	}
	else {
		throw new Error("Project not found : "+projectIdFromCli);
	}
}
if(!project) {
	throw new Error("No project currently");
}

// List of dates since project start until today
function getDays() {
	const days = [];
	const start = new Date(project.start_date);
	let end = new Date(project.end_date);
	if(end > new Date()) { end = new Date(); }
	for(var arr=[],dt=new Date(start); dt<=end; dt.setDate(dt.getDate()+1)){
		days.push(new Date(dt).toISOString().split("T")[0]);
	}
	return days;
}


// Notes statistics
const days = getDays();
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
		const subpromises = noteSource.terms.map(term => (
			fetch(`${CONFIG.OSM_URL}/api/0.6/notes/search.json?q=${encodeURIComponent(term)}&limit=10000&closed=-1&from=${project.start_date}`)
			.then(res => res.json())
		));

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
		fs.writeFile(CSV_NOTES, csvText, (err) => {
			if(err) { console.error(err); }
			else { console.log("Written note stats"); }
		});

		// User notes
		const csvUserNotes = userNotes.map(un => un.join(",")).join("\n");
		fs.writeFile(CSV_NOTES_CONTRIBS, csvUserNotes, (err) => {
			if(err) { console.error(err); }
			else { console.log("Written user notes contributions"); }
		});

		// User names from notes
		const csvUserNames = Object.entries(userNames).map(e => `${e[0]},${e[1]}`).join("\n");
		fs.writeFile(CSV_NOTES_USERS, csvUserNames, (err) => {
			if(err) { console.error(err); }
			else { console.log("Written user names from notes"); }
		});

		return true;
	});
}


// Script text
const separator = `echo "-------------------------------------------------------------------"
echo ""`;


// Points per contributions (13_points.sql)
const pointsEntries = [];
Object.entries(projects).filter(e => e[1].statistics && e[1].statistics.points).forEach(e => {
	Object.entries(e[1].statistics.points).forEach(ep => {
		pointsEntries.push([e[0], ep[0], ep[1]]);
	});
});
const sqlPoints = `
-- Function to get points for each type of contribution per project
-- Generated automatically by npm run project:update
CREATE OR REPLACE FUNCTION get_points(the_project VARCHAR, the_contrib VARCHAR) RETURNS INT AS $$
BEGIN
	RETURN CASE
${pointsEntries.map(pe => `		WHEN the_project = '${pe[0]}' AND the_contrib = '${pe[1]}' THEN ${pe[2]}`).join("\n")}
		ELSE 1
	END;
END;
$$ LANGUAGE plpgsql
IMMUTABLE LEAKPROOF;
`;
fs.writeFile(OUTPUT_SQL_POINTS, sqlPoints, err => {
	if(err) { throw new Error(err); }
	console.log("Written SQL points");
});


// Feature counts script (optional)
const counts = project.statistics.count ? `
echo "==== Count features"
rm -rf "${CSV_COUNT}"
if [ -f ${CONFIG.WORK_DIR}/osh_timestamp ]; then
	cnt_timestamp=$(cat ${CONFIG.WORK_DIR}/osh_timestamp)
	cnt_timestamp=$(date -Idate --utc -d \$cnt_timestamp)
	cur_timestamp=$(date -Idate --utc)
	echo "Counting from \$cnt_timestamp"

	days=$cnt_timestamp
	until [[ \$cnt_timestamp > \$cur_timestamp ]]; do
		cnt_timestamp=$(date -Idate --utc -d "\$cnt_timestamp + 1 day" )
		days="\$days \$cnt_timestamp"
	done
	days=($days)
else
    echo "Counting from project start"
	days=(${getDays().map(d => `"${d}"`).join(" ")})

	${PSQL} -c "DELETE FROM pdm_feature_counts WHERE project = '${project.id}'"
fi
for day in "\${days[@]}"; do
	echo "Processing $day"
	nbday=$(osmium time-filter "${OSH_USEFULL}" \${day}T00:00:00Z -o - -f osm.pbf | osmium tags-count - -F osm.pbf ${project.database.osmium_tag_filter.split("/").pop()} | cut -d$'\\t' -f 1 | paste -sd+ | bc)
	if [ "$nbday" == "" ]; then
		nbday="0"
	fi
	echo "${project.id},$day,$nbday" \\
	>> "${CSV_COUNT}"
done

# Insert CSV into database with a temp table to take advantage of ON CONFLICT
${PSQL} -c "CREATE TABLE IF NOT EXISTS pdm_feature_counts_tmp (LIKE pdm_feature_counts)"
${PSQL} -c "TRUNCATE TABLE pdm_feature_counts_tmp"
${PSQL} -c "\\COPY pdm_feature_counts_tmp FROM '${CSV_COUNT}' CSV"
${PSQL} -c "INSERT INTO pdm_feature_counts SELECT * FROM pdm_feature_counts_tmp ON CONFLICT (project,ts) DO UPDATE SET amount=EXCLUDED.amount"
${PSQL} -c "DROP TABLE pdm_feature_counts_tmp"
rm -rf "${CSV_COUNT}"
${separator}` : '';


// Notes count (optional)
const noteCounts = notesSources.length > 0 ? `
echo "==== Notes statistics"
${PSQL} -c "DELETE FROM pdm_note_counts WHERE project = '${project.id}'"
${PSQL} -c "\\COPY pdm_note_counts FROM '${CSV_NOTES}' CSV"
${PSQL} -c "\\COPY pdm_user_contribs(project, userid, ts, contribution, points) FROM '${CSV_NOTES_CONTRIBS}' CSV"
${PSQL} -c "CREATE TABLE pdm_user_names_notes(userid BIGINT, username VARCHAR)"
${PSQL} -c "\\COPY pdm_user_names_notes FROM '${CSV_NOTES_USERS}' CSV"
${PSQL} -c "INSERT INTO pdm_user_names SELECT userid, username FROM pdm_user_names_notes ON CONFLICT (userid) DO NOTHING; DROP TABLE pdm_user_names_notes;"
rm -f "${CSV_NOTES}" "${CSV_NOTES_CONTRIBS}" "${CSV_NOTES_USERS}"
${separator}` : '';


// Full script
var script = `#!/bin/bash

# Script for updating projetdumois.fr current project
# Generated automatically by npm run project:update

set -e

echo "==== Create work directory"
mkdir -p "${CONFIG.WORK_DIR}"
${separator}

if [ -f "${OSH_UPDATED}" ]; then
	echo "==== Reuse yesterday history file"
	prev_osh="${OSH_UPDATED}"
	if [ -f ${CONFIG.WORK_DIR}/osh_timestamp ]; then
		prev_timestamp=$(cat ${CONFIG.WORK_DIR}/osh_timestamp)
		echo "Timestamp: $prev_timestamp"
	else
		echo "No timestamp found"
	fi

else
	echo "==== Get cookies for authorized download of OSH PBF file"
	python3 ${__dirname}/../lib/sendfile_osm_oauth_protector/oauth_cookie_client.py \\
		--osm-host ${CONFIG.OSM_URL} \\
		-u "${CONFIG.OSM_USER}" -p "${CONFIG.OSM_PASS}" \\
		-c ${CONFIG.OSH_PBF_URL.split("/").slice(0, 3).join("/")}/get_cookie \\
		-o "${COOKIES}"

	echo "==== Download OSH PBF file"
	wget -N --no-cookies --header "Cookie: $(cat ${COOKIES} | cut -d ';' -f 1)" -P "${CONFIG.WORK_DIR}" "${CONFIG.OSH_PBF_URL}"
	wget -N --no-cookies --header "Cookie: $(cat ${COOKIES} | cut -d ';' -f 1)" -P "${CONFIG.WORK_DIR}" "${CONFIG.OSH_PBF_URL.replace("-internal.osh.pbf", ".poly")}"
	rm -f "${COOKIES}"
	prev_osh="${OSH_DOWNLOADED}"
	prev_timestamp=""
fi
${separator}

echo "==== Update OSH PBF file with replication files"
osmupdate --keep-tempfiles --day -t="${CONFIG.WORK_DIR}/osmupdate/" -v "$prev_osh" $prev_timestamp "${OSC_UPDATES}"
osmium apply-changes -H "$prev_osh" "${OSC_UPDATES}" -O -o "${OSH_UPDATED.replace(".osh.pbf", ".new.osh.pbf")}"
osmium extract -p "${OSH_POLY}" --with-history -s complete_ways "${OSH_UPDATED.replace(".osh.pbf", ".new.osh.pbf")}" -O -o "${OSH_UPDATED}"
rm -f "${OSC_UPDATES}"
${separator}


echo "==== Extract features from OSH PBF (1st pass)"
osmium tags-filter "${OSH_UPDATED}" -R ${project.database.osmium_tag_filter} -O -o "${OSH_USEFULL_IDS}"
${separator}

echo "==== Extract features based on their IDs (2nd pass)"
osmium getid --id-osm-file "${OSH_USEFULL_IDS}" --with-history "${OSH_UPDATED}" -O -o "${OSH_USEFULL}"
${separator}

echo "==== Transform changes into CSV file"
osmium cat "${OSH_USEFULL}" -O -o "${OSC_USEFULL}"
xsltproc "${OSC2CSV}" "${OSC_USEFULL}" > "${CSV_CHANGES}"
rm -f "${OSC_USEFULL}"
${separator}

echo "==== Init changes table in database"
${PSQL} -f ${__dirname}/11_project_init_tables.sql
${PSQL} -c "\\COPY pdm_changes FROM '${CSV_CHANGES}' CSV"
${PSQL} -f ${__dirname}/12_project_post_import_changes.sql
rm -f "${CSV_CHANGES}"
${separator}

echo "==== Generate user contributions"
${PSQL} -f "${__dirname}/13_points.sql"
${PSQL} -c "CREATE OR REPLACE FUNCTION ts_in_project(ts TIMESTAMP) RETURNS BOOLEAN AS \\$\\$ BEGIN RETURN ts BETWEEN '${project.start_date}' AND '${project.end_date}'; END; \\$\\$ LANGUAGE plpgsql IMMUTABLE;"
${PSQL} -f "${__dirname}/../projects/${project.id}/analysis.sql"
${PSQL} -f "${__dirname}/15_badges.sql"
${separator}
`;

if (IMPOSM_ENABLED){
	script += `echo "==== Write current state of OSM data as OSM.PBF"
	osmium time-filter "${OSH_UPDATED}" -O -o "${OSM_PBF_NOW}"
	${separator}
	`;
}

script += `${counts}
${noteCounts}
rm -f "${OSH_USEFULL}"

echo "==== Optimize database"
${PSQL} -c "REINDEX DATABASE ${CONFIG.DB_NAME}"
${separator}

m -f "${CONFIG.WORK_DIR}/osh_timestamp"
curtime=$(date -d '3 hours ago' -Iseconds --utc)
echo \${curtime/"+00:00"/"Z"} > ${CONFIG.WORK_DIR}/osh_timestamp
echo "Done"
`;

fs.writeFile(OUTPUT_SCRIPT, script, { mode: 0o766 }, err => {
	if(err) { throw new Error(err); }
	console.log("Written Bash script");
});
