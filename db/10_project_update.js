const CONFIG = require('../config.json');
const fs = require('fs');
const projects = require('../website/projects');
const { foldProjects, getProjectDays } = require('../website/utils');
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

const CSV_CHANGES = CONFIG.WORK_DIR + '/change.csv';
const CSV_NOTES = CONFIG.WORK_DIR + '/notes.csv';
const CSV_NOTES_CONTRIBS = CONFIG.WORK_DIR + '/user_notes.csv';
const CSV_NOTES_USERS = CONFIG.WORK_DIR + '/usernames_notes.csv';

const COOKIES = CONFIG.WORK_DIR + '/cookie.txt';
const PSQL = `psql "postgres://@${CONFIG.DB_HOST}:${CONFIG.DB_PORT}/${CONFIG.DB_NAME}"`;
const OUTPUT_SCRIPT = __dirname+'/09_project_update_tmp.sh';
const HAS_BOUNDARY = `${PSQL} -c "SELECT * FROM pdm_boundary LIMIT 1" > /dev/null 2>&1 `;

const runForAll = process.argv.slice(2).pop() === "all";

const pgPool = new Pool({
	host: CONFIG.DB_HOST,
	database: CONFIG.DB_NAME,
	port: CONFIG.DB_PORT
});

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

echo "== Prerequisites"
nbProjects=$(${PSQL} -tAc "select count(*) from pdm_projects" | sed 's/[^0-9]*//g' )
nbPoints=$(${PSQL} -tAc "select count(*) from pdm_projects_points" | sed 's/[^0-9]*//g' )

if [[ $nbProjects < 1 ]]; then
  echo "WARN: No known projects in SQL projects table"
fi
if [[ $nbPoints < 1 ]]; then
  echo "WARN: No declared points for projects contributions"
fi
${separator}

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

if (IMPOSM_ENABLED){
	script += `
echo "== Write current state of OSM data as OSM.PBF"
osmium time-filter "${OSH_UPDATED}" -O -o "${OSM_PBF_NOW}"
${separator}
`;
}

const projectsToProcess = runForAll ? Object.values(projects) : projectsFold.current;
projectsToProcess.forEach(project => {
	let oshInput = OSH_UPDATED;
	const oshProject = OSH_FILTERED.replace("filtered", `${project.id.split("_").pop()}`);
	const oshFiltered = OSH_FILTERED.replace("filtered", `${project.id.split("_").pop()}.filtered`);
	const oshUsefull = OSH_USEFULL.replace("usefull", `${project.id.split("_").pop()}.usefull`);

	let tagFilterParts = project.database.osmium_tag_filter.split("&");

	script += `
cur_timestamp=$(date -Idate --utc ${new Date(project.end_date+"T23:59:59Z").getTime() < Date.now() ? `-d ${project.end_date}` : ""})
cnt_timestamp=${new Date(project.end_date+"T23:59:59Z").getTime() < Date.now() ? `$(date -Idate --utc -d ${project.start_date})` : `""`}
prj_timestamp=$(date -Idate --utc -d ${project.start_date})
if [[ -z \$cnt_timestamp && -n "\$prev_timestamp" ]]; then
	cnt_timestamp=$(date -Idate --utc -d \$prev_timestamp)
fi
if [[ -z \$cnt_timestamp || \$prj_timestamp>=\$cnt_timestamp ]]; then
	cnt_timestamp=$prj_timestamp
fi

echo "== Begin process for project ${project.id}"
if [ -f "${oshFiltered}" ]; then
	echo "Remove existing filtered file"
	rm -f "${oshFiltered}"
fi`;

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
rm -f "${CSV_CHANGES}"
osmium time-filter "${oshUsefull}" \${cnt_timestamp}T00:00:00Z \${cur_timestamp}T00:00:00Z -f osh.pbf -o - | osmium cat - -F osh.pbf -O -o "${OSC_USEFULL}"
xsltproc "${OSC2CSV}" "${OSC_USEFULL}" | sed "s/^/${project.id},/" > "${CSV_CHANGES}"
rm -f "${OSC_USEFULL}"

echo "   => Init changes table in database between \${cnt_timestamp} and \${cur_timestamp}"
${PSQL} -c "DELETE FROM pdm_changes WHERE project='${project.id}' AND ts BETWEEN '\${cnt_timestamp}T00:00:00Z' AND '\${cur_timestamp}T00:00:00Z'"

${PSQL} -c "CREATE TABLE IF NOT EXISTS pdm_changes_tmp (LIKE pdm_changes)"
${PSQL} -c "TRUNCATE TABLE pdm_changes_tmp"

${PSQL} -c "\\COPY pdm_changes_tmp (project, action, osmid, version, ts, username, userid, tags) FROM '${CSV_CHANGES}' CSV"

${PSQL} -v project_id="'${project.id}'" -v project_table="pdm_project_${project.id.split("_").pop()}" -f "${__dirname}/13_changes_populate.sql"
if ${HAS_BOUNDARY}; then
	${PSQL} -v project_id="'${project.id}'" -v project_table="pdm_project_${project.id.split("_").pop()}" -f "${__dirname}/13_changes_boundary.sql"
fi
${PSQL} -c "DROP TABLE pdm_changes_tmp"

if [ -f "${__dirname}/../projects/${project.id}/contribs.sql" ]; then
	echo "Including project custom contributions"
	${PSQL} -f "${__dirname}/../projects/${project.id}/contribs.sql"
fi

rm -f "${CSV_CHANGES}"
${separator}

echo "== Statistics for project ${project.id}"`;
	let osmStats = OSH_USEFULL.replace("usefull.osh.pbf", `${project.id.split("_").pop()}.stats.osm.pbf`);
	let osmStatsFiltered = OSH_USEFULL.replace("usefull.osh.pbf", `${project.id.split("_").pop()}.filtered.stats.osm.pbf`);

	// Dénombrements
	if (project.statistics.count){
		script += `
echo "   => Count features"
${PSQL} -c "DELETE FROM pdm_feature_counts WHERE project='${project.id}' AND ts BETWEEN '\${cnt_timestamp}T00:00:00Z' AND '\${cur_timestamp}T00:00:00Z'"
if ${HAS_BOUNDARY}; then
	${PSQL} -c "DELETE FROM pdm_feature_counts_per_boundary WHERE project='${project.id}' AND ts BETWEEN '\${cnt_timestamp}T00:00:00Z' AND '\${cur_timestamp}T00:00:00Z'"
fi

echo "Counting from \$cnt_timestamp"
days=""
local_timestamp=$cnt_timestamp
until [[ ! "\$local_timestamp" < "\$cur_timestamp" ]]; do
	days="\$days \$local_timestamp"
	local_timestamp=$(date -Idate --utc -d "\$local_timestamp + 1 day" )
done
days=($\{days##*( )\})
for day in "\${days[@]}"; do
	echo "Processing $day"
	osmium time-filter "${oshUsefull}" \${day}T23:59:59Z --no-progress -O -o ${osmStats} -f osm.pbf
	`;
	let tagFilterLastPart = tagFilterParts.pop();
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

	${PSQL} -c "INSERT INTO pdm_feature_counts (project,ts,amount) VALUES ('${project.id}', '\${day}T23:59:59Z', \${nbday}) ON CONFLICT (project,ts) DO UPDATE SET amount=EXCLUDED.amount"
	if ${HAS_BOUNDARY}; then
		${PSQL} -c "INSERT INTO pdm_feature_counts_per_boundary(project, boundary, ts, amount) SELECT '${project.id}' as project, boundary, '\${day}T23:59:59Z' AS ts, count(*) as amount FROM pdm_features_boundary WHERE project='${project.id}' AND ('\${day}T23:59:59Z' BETWEEN start_ts AND end_ts OR (start_ts is null and end_ts is null) OR '\${day}T23:59:59Z' > start_ts OR '\${day}T23:59:59Z' < end_ts) GROUP BY project, boundary ON CONFLICT (project,boundary,ts) DO UPDATE SET amount=EXCLUDED.amount"
	fi
done
rm -f "${osmStats}"
`;
	}

	script += `
	rm -f "${oshUsefull}"
	${separator}

	echo "== Generate user contributions between \${cnt_timestamp} and \${cur_timestamp}"
	${PSQL} -v project_id="'${project.id}'" -v start_date="'\${cnt_timestamp}T00:00:00Z'" -v end_date="'\${cur_timestamp}T00:00:00Z'" -f "${__dirname}/12_projects_contribs.sql"
	${separator}
	`;

	// Notes count (optional)
	let notesSources = processNotes (project);
	if (notesSources.length > 0){
		script += `
echo "   => Notes statistics"
${PSQL} -c "DELETE FROM pdm_note_counts WHERE project='${project.id}' AND ts BETWEEN '\${cnt_timestamp}T00:00:00Z' AND '\${cur_timestamp}T00:00:00Z'"
${PSQL} -c "\\COPY pdm_note_counts FROM '${CSV_NOTES}' CSV"
${PSQL} -c "\\COPY pdm_user_contribs(project, userid, ts, contribution, points) FROM '${CSV_NOTES_CONTRIBS}' CSV"
${PSQL} -c "CREATE TABLE pdm_user_names_notes(userid BIGINT, username VARCHAR)"
${PSQL} -c "\\COPY pdm_user_names_notes FROM '${CSV_NOTES_USERS}' CSV"
${PSQL} -c "INSERT INTO pdm_user_names SELECT userid, username FROM pdm_user_names_notes ON CONFLICT (userid) DO NOTHING; DROP TABLE pdm_user_names_notes;"
rm -f "${CSV_NOTES}" "${CSV_NOTES_CONTRIBS}" "${CSV_NOTES_USERS}"`;
	}

});

script += `
echo "== Optimize database"
if ${HAS_BOUNDARY}; then
	${PSQL} -c "REFRESH MATERIALIZED VIEW pdm_boundary_subdivide"
	${PSQL} -c "REFRESH MATERIALIZED VIEW pdm_boundary_tiles"
fi
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
