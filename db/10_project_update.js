const CONFIG = require('../config.json');
const fs = require('fs');
const projects = require('../website/projects');
const { foldProjects } = require('../website/utils');
const fetch = require('node-fetch');
const booleanContains = require('@turf/boolean-contains').default;
const {Pool, Client} = require('pg')

/*
 * Generates 09_project_update_tmp.sh script
 * in order to update project statistics and data daily
 */

// Constants
let projectsFold = foldProjects(projects);

const OSH_POLY = CONFIG.WORK_DIR + '/' + CONFIG.OSH_PBF_URL.split("/").pop().replace("-internal.osh.pbf", ".poly");
const OSH_UPDATED = CONFIG.WORK_DIR + '/' + CONFIG.OSH_PBF_URL.split("/").pop().replace(".osh.pbf", ".latest.osh.pbf");
const OSH_UPDATED_NEW = CONFIG.WORK_DIR + '/' + CONFIG.OSH_PBF_URL.split("/").pop().replace(".osh.pbf", ".latest.new.osh.pbf");
const OSM_PBF_NOW = CONFIG.WORK_DIR + '/' + CONFIG.OSH_PBF_URL.split("/").pop().replace(".osh.pbf", ".osm.pbf");
const OSH_FILTERED = CONFIG.WORK_DIR + '/filtered.osh.pbf';
const OSH_USEFULL = CONFIG.WORK_DIR + '/usefull.osh.pbf';
const IMPOSM_ENABLED = CONFIG.DB_USE_IMPOSM_UPDATE;
if (IMPOSM_ENABLED == null){
	IMPOSM_ENABLED = true;
}

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

const pgPool = new Pool({
	host: CONFIG.DB_HOST,
	database: CONFIG.DB_NAME,
	port: CONFIG.DB_PORT
});

// List of dates since project start until today
function getProjectDays(project) {
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
function processNotes (project){
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

	return notesSources;
}

// Projects installation
console.log("Projects installation");
pgPool.query("TRUNCATE TABLE pdm_projects", (err, res) => {
	if (err){
		throw new Error(`Erreur SQL: ${err}`);
	}
});
pgPool.query("TRUNCATE TABLE pdm_projects_points", (err, res) => {
	if (err){
		throw new Error(`Erreur SQL: ${err}`);
	}
});

let projectsQry = "INSERT INTO pdm_projects (project, start_date, end_date) VALUES ";
let projectPointsQry = "INSERT INTO pdm_projects_points (project, contrib, points) VALUES ";

Object.values(projects).forEach(project => {
	projectsQry += `('${project.id}', '${project.start_date}', '${project.end_date}'),`;

	Object.entries(project.statistics.points).forEach(([contrib,value]) => {
		projectPointsQry += `('${project.id}','${contrib}', ${value}),`;
	});
});

pgPool.query(projectsQry.substr(0, projectsQry.length-1), (err, res) => {
	if (err){
		throw new Error(`Erreur SQL: ${err}`);
	}
});
pgPool.query(projectPointsQry.substr(0, projectPointsQry.length-1), (err, res) => {
	if (err){
		throw new Error(`Erreur SQL: ${err}`);
	}
});

// Script text
const separator = `echo "-------------------------------------------------------------------"
echo ""`;

// Full script
var script = `#!/bin/bash

# Script for updating current projects
# Generated automatically by npm run project:update

set -e

echo "== Create work directory"
mkdir -p "${CONFIG.WORK_DIR}"
${separator}

if [ -f "${OSH_UPDATED}" ]; then
	echo "== Reuse existing history file"
	prev_osh="${OSH_UPDATED}"
	if [ -f ${CONFIG.WORK_DIR}/osh_timestamp ]; then
		prev_timestamp=$(cat ${CONFIG.WORK_DIR}/osh_timestamp)
		echo "Timestamp: $prev_timestamp"
	else
		echo "No timestamp found"
	fi

else
	echo "== Get cookies for authorized download of OSH PBF file"
	python3 ${__dirname}/../lib/sendfile_osm_oauth_protector/oauth_cookie_client.py \\
		--osm-host ${CONFIG.OSM_URL} \\
		-u "${CONFIG.OSM_USER}" -p "${CONFIG.OSM_PASS}" \\
		-c ${CONFIG.OSH_PBF_URL.split("/").slice(0, 3).join("/")}/get_cookie \\
		-o "${COOKIES}"

	echo "== Download OSH PBF file"
	wget -N --no-cookies --header "Cookie: $(cat ${COOKIES} | cut -d ';' -f 1)" -P "${CONFIG.WORK_DIR}" -O "${OSH_UPDATED}" "${CONFIG.OSH_PBF_URL}"
	wget -N --no-cookies --header "Cookie: $(cat ${COOKIES} | cut -d ';' -f 1)" -P "${CONFIG.WORK_DIR}" "${CONFIG.OSH_PBF_URL.replace("-internal.osh.pbf", ".poly")}"
	rm -f "${COOKIES}"
	prev_osh="${OSH_UPDATED}"
	prev_timestamp=""
fi
${separator}

echo "== Update OSH PBF file with replication files"
osmupdate --keep-tempfiles --day -t="${CONFIG.WORK_DIR}/osmupdate/" -v "$prev_osh" $prev_timestamp "${OSC_UPDATES}"
osmium apply-changes -H "$prev_osh" "${OSC_UPDATES}" -O -o "${OSH_UPDATED_NEW}"
osmium extract -p "${OSH_POLY}" --with-history -s complete_ways "${OSH_UPDATED_NEW}" -O -o "${OSH_UPDATED}"
rm -f "${OSC_UPDATES}"
rm -f "${OSH_UPDATED_NEW}"
${separator}
`;

projectsFold.current.forEach(project => {
	let oshInput = OSH_UPDATED;
	const oshProject = OSH_FILTERED.replace("filtered", `${project.id.split("_").pop()}`);
	const oshFiltered = OSH_FILTERED.replace("filtered", `${project.id.split("_").pop()}.filtered`);
	const oshUsefull = OSH_USEFULL.replace("usefull", `${project.id.split("_").pop()}.usefull`);

	script += `
echo "== Begin process for project ${project.id}"
if [ -f "${oshFiltered}" ]; then
	echo "Remove existing filtered file"
	rm -f "${oshFiltered}"
fi`;

	let tagFilterParts = project.database.osmium_tag_filter.split("&");
	tagFilterParts.forEach(tagFilter => {
		script += `
echo "   => Extract features from OSH PBF (${tagFilter})"

osmium tags-filter "${oshInput}" -R ${tagFilter} -O -o "${oshProject}"
mv "${oshProject}" "${oshFiltered}"`;
		oshInput = oshFiltered;
	});

	script += `
echo "   => Produce usefull file"
osmium getid --id-osm-file "${oshFiltered}" --with-history "${OSH_UPDATED}" -O -o "${oshUsefull}"

echo "   => Transform changes into CSV file"
osmium cat "${oshUsefull}" -O -o "${OSC_USEFULL}"
xsltproc "${OSC2CSV}" "${OSC_USEFULL}" | sed "s/^/${project.id},/" > "${CSV_CHANGES}"
rm -f "${OSC_USEFULL}"

echo "   => Init changes table in database"
${PSQL} -c "DELETE FROM pdm_changes WHERE project='${project.id}';"
${PSQL} -c "\\COPY pdm_changes (project, action, osmid, version, ts, username, userid, tags) FROM '${CSV_CHANGES}' CSV"
if [ -f "${__dirname}/../projects/${project.id}/contribs.sql" ]; then
	echo "Including project custom contributions"
	${PSQL} -f "${__dirname}/../projects/${project.id}/contribs.sql"
fi

rm -f "${CSV_CHANGES}"
${separator}
`;
});

script += `
echo "== Generate user contributions"
${PSQL} -f "${__dirname}/11_changes_contribs.sql"
${PSQL} -f "${__dirname}/12_projects_contribs.sql"
${separator}
`;

if (IMPOSM_ENABLED){
	script += `
echo "== Write current state of OSM data as OSM.PBF"
osmium time-filter "${OSH_UPDATED}" -O -o "${OSM_PBF_NOW}"
${separator}
`;
}

script += `
rm -rf "${CSV_COUNT}"`;

projectsFold.current.forEach(project => {
	script += `
echo "== Statistics for project ${project.id}"`;

	let oshUsefull = OSH_USEFULL.replace("usefull", `${project.id.split("_").pop()}.usefull`);
	let osmStats = OSH_USEFULL.replace("usefull.osh.pbf", `${project.id.split("_").pop()}.stats.osm.pbf`);
	let osmStatsFiltered = OSH_USEFULL.replace("usefull.osh.pbf", `${project.id.split("_").pop()}.filtered.stats.osm.pbf`);
	let tagFilterParts = project.database.osmium_tag_filter.split("&");
	let tagFilterLastPart = tagFilterParts.pop();

	// Dénombrements
	if (project.statistics.count){
		script += `
echo "   => Count features"
days=""
cur_timestamp=$(date -Idate --utc)
if [ -f ${CONFIG.WORK_DIR}/osh_timestamp ]; then
	cnt_timestamp=$(cat ${CONFIG.WORK_DIR}/osh_timestamp)
	cnt_timestamp=$(date -Idate --utc -d \$cnt_timestamp)
else
	cnt_timestamp=$(date -Idate --utc -d ${project.start_date})

	${PSQL} -c "DELETE FROM pdm_feature_counts WHERE project = '${project.id}'"
fi
echo "Counting from \$cnt_timestamp"

until [[ \$cnt_timestamp>=\$cur_timestamp ]]; do
	days="\$days \$cnt_timestamp"
	cnt_timestamp=$(date -Idate --utc -d "\$cnt_timestamp + 1 day" )
done
days=($\{days##*( )\})
for day in "\${days[@]}"; do
	echo "Processing $day"
	osmium time-filter "${oshUsefull}" \${day}T00:00:00Z -O -o ${osmStats} -f osm.pbf
	`;
	tagFilterParts.forEach(tagFilter => {
		script += `
		osmium tags-filter "${osmStats}" -R ${tagFilter} --no-progress -O -o "${osmStatsFiltered}"
		mv "${osmStatsFiltered}" "${osmStats}"
		`;
	});
	
	script += `nbday=$(osmium tags-count "${osmStats}" --no-progress -F osm.pbf ${tagFilterLastPart.split("/").pop()} | cut -d$'\\t' -f 1 | paste -sd+ | bc)
	if [ "$nbday" == "" ]; then
		nbday="0"
	fi
	echo "${project.id},$day,$nbday" >> "${CSV_COUNT}"
done
rm -f "${osmStats}"
`;
	}

	// Notes count (optional)
	let notesSources = processNotes (project);
	if (notesSources.length > 0){
		script += `
echo "   => Notes statistics"
${PSQL} -c "DELETE FROM pdm_note_counts WHERE project = '${project.id}'"
${PSQL} -c "\\COPY pdm_note_counts FROM '${CSV_NOTES}' CSV"
${PSQL} -c "\\COPY pdm_user_contribs(project, userid, ts, contribution, points) FROM '${CSV_NOTES_CONTRIBS}' CSV"
${PSQL} -c "CREATE TABLE pdm_user_names_notes(userid BIGINT, username VARCHAR)"
${PSQL} -c "\\COPY pdm_user_names_notes FROM '${CSV_NOTES_USERS}' CSV"
${PSQL} -c "INSERT INTO pdm_user_names SELECT userid, username FROM pdm_user_names_notes ON CONFLICT (userid) DO NOTHING; DROP TABLE pdm_user_names_notes;"
rm -f "${CSV_NOTES}" "${CSV_NOTES_CONTRIBS}" "${CSV_NOTES_USERS}"`;
	}

	script += `
rm -f "${oshUsefull}"
${separator}
`;
});

script += `
if [[ -f "${CSV_COUNT}" ]] && [[ $(wc -l "${CSV_COUNT}")>0 ]]; then
	# Insert CSV into database with a temp table to take advantage of ON CONFLICT
	${PSQL} -c "CREATE TABLE IF NOT EXISTS pdm_feature_counts_tmp (LIKE pdm_feature_counts)"
	${PSQL} -c "TRUNCATE TABLE pdm_feature_counts_tmp"
	${PSQL} -c "\\COPY pdm_feature_counts_tmp FROM '${CSV_COUNT}' CSV"
	${PSQL} -c "INSERT INTO pdm_feature_counts SELECT * FROM pdm_feature_counts_tmp ON CONFLICT (project,ts) DO UPDATE SET amount=EXCLUDED.amount"
	${PSQL} -c "DROP TABLE pdm_feature_counts_tmp"
fi
rm -f "${CSV_COUNT}"

echo "== Optimize database"
${PSQL} -c "REINDEX DATABASE ${CONFIG.DB_NAME}"
${separator}

rm -f "${CONFIG.WORK_DIR}/osh_timestamp"
curtime=$(date -d '3 hours ago' -Iseconds --utc)
echo \${curtime/"+00:00"/"Z"} > ${CONFIG.WORK_DIR}/osh_timestamp
echo "Done"
`;

fs.writeFile(OUTPUT_SCRIPT, script, { mode: 0o766 }, err => {
	if(err) { throw new Error(err); }
	console.log("Written Bash script");
});
