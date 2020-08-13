const CONFIG = require('../config.json');
const fs = require('fs');
const projects = require('../website/projects');
const { filterProjects } = require('../website/utils');
const fetch = require('node-fetch');

/*
 * Generates 09_project_update_tmp.sh script
 * in order to update project statistics and data daily
 */

// Constants
let project = filterProjects(projects).current;
const OSH_PBF = CONFIG.WORK_DIR + '/' + CONFIG.OSH_PBF_URL.split("/").pop();
const OSH_PBF_FULL = CONFIG.WORK_DIR + '/' + CONFIG.OSH_PBF_URL.split("/").pop().replace(".osh.pbf", ".latest.osh.pbf");
const OSM_PBF_LATEST = CONFIG.WORK_DIR + '/' + CONFIG.OSH_PBF_URL.split("/").pop().replace(".osh.pbf", ".osm.pbf");
const OSH_POLY = OSH_PBF.replace("-internal.osh.pbf", ".poly");
const OSC_1 = CONFIG.WORK_DIR + '/extract_filtered.osc.gz';
const OSC_IDS = CONFIG.WORK_DIR + '/extract_osm_ids.txt';
const OSC_IDS_SPLIT = CONFIG.WORK_DIR + '/extract_ids_';
const OSC2IDS = __dirname+'/osc2ids.xslt';
const OSC2CSV = __dirname+'/osc2csv.xslt';
const OSH4COUNT = CONFIG.WORK_DIR + '/count.osh.pbf';
const OSCCOUNT = CONFIG.WORK_DIR + '/count.csv';
const OSC_FULL = CONFIG.WORK_DIR + '/changes.osc.gz';
const OSC_LOCAL = CONFIG.WORK_DIR + '/changes.local.osc.gz';
const CSV_CHANGES = CONFIG.WORK_DIR + '/change.csv';
const CSV_NOTES = CONFIG.WORK_DIR + '/notes.csv';
const COOKIES = CONFIG.WORK_DIR + '/cookie.txt';
const PSQL = `psql postgres://${CONFIG.DB_USER}:${CONFIG.DB_PASS}@${CONFIG.DB_HOST}:${CONFIG.DB_PORT}/${CONFIG.DB_NAME}`;
const OUTPUT_SCRIPT = __dirname+'/09_project_update_tmp.sh';

// Check if there is any project to analyse
const projectIdFromCli = process.argv.slice(2).pop();
if(projectIdFromCli && projects[projectIdFromCli]) {
	project = projects[projectIdFromCli];
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
	days.forEach(day => notesPerDay[day] = { open: 0, closed: 0 });

	// Review each note source
	const promises = notesSources.map((noteSource, nsid) => {
		// Call OSM API for each term
		const subpromises = noteSource.terms.map(term => (
			fetch(`${CONFIG.OSM_URL}/api/0.6/notes/search.json?q=${encodeURIComponent(term)}&limit=10000&closed=-1&from=${project.start_date}`)
			.then(res => res.json())
		));

		// Process received notes
		return Promise.all(subpromises).then(results => {
			results.forEach(result => {
				result.features.forEach(f => {
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
				});
			});
			return true;
		});
	});

	// Merge all statistics from all sources
	Promise.all(promises).then(() => {
		const csvText = Object.entries(notesPerDay).map(e => `${project.id},${e[0]},${e[1].open},${e[1].closed}`).join("\n");
		fs.writeFile(CSV_NOTES, csvText, (err) => {
			console.log("Written note stats");
		});
		return true;
	});
}


// Script text
const separator = `echo "-------------------------------------------------------------------"
echo ""`;

// Feature counts script (optional)
const counts = project.statistics.count ? `
echo "==== Count features"
rm -rf "${OSCCOUNT}"
osmium tags-filter "${OSH_PBF}" ${project.database.osmium_tag_filter} -O -o "${OSH4COUNT}"
days=(${getDays().map(d => `"${d}"`).join(" ")})
for day in "\${days[@]}"; do
	echo "Processing $day"
	nbday=$(osmium time-filter "${OSH4COUNT}" \${day}T00:00:00Z -o - -f osm.pbf | osmium tags-count - -F osm.pbf ${project.database.osmium_tag_filter.split("/").pop()} | cut -d$'\\t' -f 1)
	if [ "$nbday" == "" ]; then
		nbday="0"
	fi
	echo "${project.id},$day,$nbday" \\
	>> "${OSCCOUNT}"
done

# Insert CSV into database
${PSQL} -c "DELETE FROM feature_counts WHERE project = '${project.id}'"
${PSQL} -c "\\COPY feature_counts FROM '${OSCCOUNT}' CSV"
${separator}` : '';

// Notes count (optional)
const noteCounts = notesSources.length > 0 ? `
echo "==== Count notes"
${PSQL} -c "DELETE FROM note_counts WHERE project = '${project.id}'"
${PSQL} -c "\\COPY note_counts FROM '${CSV_NOTES}' CSV"
${separator}` : '';

// Full script
const script = `#!/bin/bash

# Script for updating projetdumois.fr current project
# Generated automatically by npm run project:update

set -e

echo "==== Create work directory"
mkdir -p "${CONFIG.WORK_DIR}"
${separator}

echo "==== Get cookies for authorized download of OSH PBF file"
python3 ${__dirname}/../lib/sendfile_osm_oauth_protector/oauth_cookie_client.py \\
	--osm-host ${CONFIG.OSM_URL} \\
	-u "${CONFIG.OSM_USER}" -p "${CONFIG.OSM_PASS}" \\
	-c ${CONFIG.OSH_PBF_URL.split("/").slice(0, 3).join("/")}/get_cookie \\
	-o "${COOKIES}"
${separator}

echo "==== Download OSH PBF file"
wget -N --no-cookies --header "Cookie: $(cat ${COOKIES} | cut -d ';' -f 1)" -P "${CONFIG.WORK_DIR}" "${CONFIG.OSH_PBF_URL}"
wget -N --no-cookies --header "Cookie: $(cat ${COOKIES} | cut -d ';' -f 1)" -P "${CONFIG.WORK_DIR}" "${CONFIG.OSH_PBF_URL.replace("-internal.osh.pbf", ".poly")}"
${separator}

echo "==== Update OSH PBF file with replication files"
if [ -f "${OSH_PBF_FULL}" ]; then
	prev_osh="${OSH_PBF_FULL}"
else
	prev_osh="${OSH_PBF}"
fi
osmupdate --keep-tempfiles --day -t="${CONFIG.WORK_DIR}/osmupdate/" -v "$prev_osh" "${OSC_FULL}"
osmium extract -p "${OSH_POLY}" -s simple "${OSC_FULL}" -O -o "${OSC_LOCAL}"
osmium apply-changes -H "$prev_osh" "${OSC_LOCAL}" -O -o "${OSH_PBF_FULL.replace(".osh.pbf", ".new.osh.pbf")}"
rm -f "${OSH_PBF_FULL}"
mv "${OSH_PBF_FULL.replace(".osh.pbf", ".new.osh.pbf")}" "${OSH_PBF_FULL}"
${separator}

echo "==== Extract changes from OSH PBF (1st pass)"
osmium tags-filter "${OSH_PBF_FULL}" -R ${project.database.osmium_tag_filter} -O -o "${OSC_1}"
${separator}

echo "==== Transform changes into list of OSM IDs"
xsltproc "${OSC2IDS}" "${OSC_1}" | sort | uniq  > "${OSC_IDS}"
${separator}

echo "==== Extract changes from OSH PBF (2nd pass)"
rm -f ${OSC_IDS_SPLIT}*.osc.gz
split -l 5000 "${OSC_IDS}" "${OSC_IDS_SPLIT}"
for i in ${OSC_IDS_SPLIT}*; do
	echo "--- Processing IDS $i"
	osmium getid "${OSH_PBF_FULL}" -H -i "$i" -O -o "$i.osc.gz"
done
${separator}

echo "==== Transform changes into CSV file"
rm -f "${CSV_CHANGES}"
for i in ${OSC_IDS_SPLIT}*.osc.gz; do
	echo "--- Processing changes $i"
	xsltproc "${OSC2CSV}" "$i" >> "${CSV_CHANGES}"
done
${separator}

echo "==== Init changes table in database"
${PSQL} -f ${__dirname}/11_project_init_tables.sql
${PSQL} -c "\\COPY osm_changes FROM '${CSV_CHANGES}' CSV"
${PSQL} -f ${__dirname}/12_project_post_import_changes.sql
${separator}

echo "==== Generate user contributions"
${PSQL} -c "CREATE OR REPLACE FUNCTION ts_in_project(ts TIMESTAMP) RETURNS BOOLEAN AS \\$\\$ BEGIN RETURN ts BETWEEN '${project.start_date}' AND '${project.end_date}'; END; \\$\\$ LANGUAGE plpgsql IMMUTABLE;"
${PSQL} -f "${__dirname}/../projects/${project.id}/analysis.sql"
${separator}

echo "==== Write current state of OSM data as OSM.PBF"
osmium time-filter "${OSH_PBF_FULL}" -O -o "${OSM_PBF_LATEST}"
${separator}

${counts}
${noteCounts}

echo "==== Optimize database"
${PSQL} -c "REINDEX DATABASE ${CONFIG.DB_NAME}"
${separator}

echo "==== Clean-up temporary files"
rm -f "${OSC_IDS}" "${OSC_1}" "${CSV_CHANGES}" "${OSH4COUNT}" "${OSC_FULL}" "${OSC_LOCAL}" ${OSC_IDS_SPLIT}*
${separator}

echo "Done"
`;

fs.writeFile(OUTPUT_SCRIPT, script, { mode: 0o766 }, err => {
	if(err) { throw new Error(err); }
	console.log("Done");
});
