const CONFIG = require('../config.json');
const fs = require('fs');
const projects = require('../website/projects');
const { filterProjects } = require('../website/utils');

// Constants
const project = filterProjects(projects).current;
const OSH_PBF = CONFIG.WORK_DIR + '/extract.osh.pbf';
const OSC_1 = CONFIG.WORK_DIR + '/extract_filtered.osc.gz';
const OSC_IDS = CONFIG.WORK_DIR + '/extract_osm_ids.txt';
const OSC_IDS_SPLIT = CONFIG.WORK_DIR + '/extract_ids_';
const OSC2IDS = __dirname+'/osc2ids.xslt';
const OSC2CSV = __dirname+'/osc2csv.xslt';
const OSH4COUNT = CONFIG.WORK_DIR + '/count.osh.pbf';
const OSCCOUNT = CONFIG.WORK_DIR + '/count.csv';
const CSV_CHANGES = CONFIG.WORK_DIR + '/change.csv';
const COOKIES = CONFIG.WORK_DIR + '/cookie_output_file.txt';
const PSQL = `psql postgres://${CONFIG.DB_USER}:${CONFIG.DB_PASS}@${CONFIG.DB_HOST}:${CONFIG.DB_PORT}/${CONFIG.DB_NAME}`;
const OUTPUT_SCRIPT = __dirname+'/09_project_update_tmp.sh';

// Check if there is any project to analyse
if(!project) {
	throw new Error("No project currently");
}

// Script text
const separator = `echo "-------------------------------------------------------------------"
echo ""`;

// Feature counts script (optional)
function getDays() {
	const start = new Date(project.start_date);
	let end = new Date(project.end_date);
	if(end > new Date()) { end = new Date(); }
	for(var arr=[],dt=new Date(start); dt<=end; dt.setDate(dt.getDate()+1)){
		arr.push(`"${new Date(dt).toISOString().split("T")[0]}"`);
	}
	return arr.join(" ");
}
const day = new Date().toISOString().split("T")[0];
const counts = project.count ? `
echo "==== Count features"
# Filter only wanted features
osmium tags-filter "${OSH_PBF}" ${project.database.osmium_tag_filter} -O -o "${OSH4COUNT}"

if [ -f "${OSCCOUNT}" ]; then
	# Append today count
	echo "${project.id},${day},\`osmium time-filter "${OSH4COUNT}" ${day}T00:00:00Z -o - -f osm.pbf | osmium tags-count - -F osm.pbf ${project.database.osmium_tag_filter.split("/").pop()} | cut -d$'\\t' -f 1\`" \\
		>> "${OSCCOUNT}"
else
	# Create counts for every day since start of project
	days=(${getDays()})
	for day in "\${days[@]}"; do
		echo "Processing $day"
		echo "${project.id},$day,\`osmium time-filter "${OSH4COUNT}" \${day}T00:00:00Z -o - -f osm.pbf | osmium tags-count - -F osm.pbf ${project.database.osmium_tag_filter.split("/").pop()} | cut -d$'\\t' -f 1\`" \\
		>> "${OSCCOUNT}"
	done
fi

# Insert CSV into database
${PSQL} -c "DELETE FROM feature_counts WHERE project = '${project.id}'"
${PSQL} -c "\\COPY feature_counts FROM '${OSCCOUNT}' CSV"
${PSQL} -c "REINDEX TABLE feature_counts"
${separator}
` : '';

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
curl -b "$(cat ${COOKIES} | cut -d ';' -f 1)" --output "${OSH_PBF}" "${CONFIG.OSH_PBF_URL}"
${separator}

echo "==== Extract changes from OSH PBF (1st pass)"
osmium tags-filter "${OSH_PBF}" -R ${project.database.osmium_tag_filter} -O -o "${OSC_1}"
${separator}

echo "==== Transform changes into list of OSM IDs"
xsltproc "${OSC2IDS}" "${OSC_1}" | sort | uniq  > "${OSC_IDS}"
${separator}

echo "==== Extract changes from OSH PBF (2nd pass)"
split -l 5000 "${OSC_IDS}" "${OSC_IDS_SPLIT}"
for i in ${OSC_IDS_SPLIT}*; do
	echo "--- Processing IDS $i"
	osmium getid "${OSH_PBF}" -H -i "$i" -O -o "$i.osc.gz"
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
${counts}
echo "==== Clean-up temporary files"
rm -f "${OSC_IDS}" "${OSC_1}" "${CSV_CHANGES}" "${OSH4COUNT}" ${OSC_IDS_SPLIT}*
${separator}

echo "Done"
`;

fs.writeFile(OUTPUT_SCRIPT, script, { mode: 0o766 }, err => {
	if(err) { throw new Error(err); }
	console.log("Done");
});
