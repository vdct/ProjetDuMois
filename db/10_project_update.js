const CONFIG = require('../config.json');
const fs = require('fs');
const projects = require('../website/projects');
const { filterProjects } = require('../website/utils');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

// Run command on filesystem as a Promise + handle errors
const promiser = (name, command) => {
	console.log(name);
	return exec(command)
	.then(result => {
		// Send failure message if any
		if(result.stderr.length > 0) {
			if(result.stderr.split('\n').filter(l => l.trim().length > 0 && !l.trim().includes('NOTICE:')).length > 0) {
				throw new Error(result.stderr);
			}
		}
		return true;
	})
	.catch(e => {
		console.error(e);
		Process.exit(1);
	});
};

// Constants
const project = filterProjects(projects).current;
const OSH_PBF = CONFIG.WORK_DIR + '/extract.osh.pbf';
const OSC2CSV = __dirname+'/osc2csv.xslt';
const CSV_CHANGES = CONFIG.WORK_DIR + '/change.csv';
const COOKIES = CONFIG.WORK_DIR + '/cookie_output_file.txt';
const PSQL = `psql postgres://${CONFIG.DB_USER}:${CONFIG.DB_PASS}@${CONFIG.DB_HOST}:${CONFIG.DB_PORT}/${CONFIG.DB_NAME}`;

// Check if there is any project to analyse
if(!project) {
	throw new Error("No project currently");
}

// Create work directory
try {
	console.log("Create work directory");
	fs.mkdirSync(CONFIG.WORK_DIR, { recursive: true });
}
catch(e) {
	if(e.code === 'EEXIST') { console.log("Work directory already exists"); }
	else { throw e; }
}

// Launch every command
promiser(
	"Get cookies for authorized download of OSH PBF file",
	`python3 ${__dirname}/../lib/sendfile_osm_oauth_protector/oauth_cookie_client.py \\
	--osm-host ${CONFIG.OSM_URL} \\
	-u "${CONFIG.OSM_USER}" -p "${CONFIG.OSM_PASS}" \\
	-c ${CONFIG.OSH_PBF_URL.split("/").slice(0, 3).join("/")}/get_cookie \\
	-o "${COOKIES}"`
)
.then(() => promiser(
	"Download OSH PBF file",
	`curl -s -S -b "$(cat ${COOKIES} | cut -d ';' -f 1)" --output "${OSH_PBF}" "${CONFIG.OSH_PBF_URL}"`
))
.then(() => promiser(
	"Extract changes from OSH PBF",
	`osmium tags-filter "${OSH_PBF}" -R ${project.database.osmium_tag_filter} -f osc \\
	| xsltproc "${OSC2CSV}" - \\
	| awk -F "\\"*,\\"*" '{print $2}' \\
	| grep -v -E "^(osmid|)$" \\
	| sed -r 's#([nwr])[a-z]+/([0-9]+)#\\1\\2#g' \\
	| osmium getid ${OSH_PBF} -i - -f osc \\
	| xsltproc "${OSC2CSV}" - \\
	> "${CSV_CHANGES}"`
))
.then(() => promiser(
	"Init changes table in database",
	`${PSQL} -f ${__dirname}/11_project_init_tables.sql`
))
.then(() => promiser(
	"Import changes CSV into database",
	`${PSQL} -c "\\COPY osm_changes FROM '${CSV_CHANGES}' CSV HEADER;"`
))
.then(() => promiser(
	"Post-import changes process",
	`${PSQL} -f ${__dirname}/12_project_post_import_changes.sql`
))
.then(() => promiser(
	"Generate user contributions",
	`${PSQL} -f "${__dirname}/../projects/${project.id}/analysis.sql"`
))
.then(res => console.log("Done"));
