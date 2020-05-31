const fs = require('fs');
const { queryParams } = require('./utils');
const PROJECTS_PATH = __dirname + '/../projects';

const projects = {};
fs.readdirSync(PROJECTS_PATH).forEach(projectDir => {
	try {
		const project = JSON.parse(fs.readFileSync(PROJECTS_PATH + '/' + projectDir + '/info.json'));

		// Add auto-computed metadata
		project.osmoseLabels = {};
		project.datasources
			.filter(ds => ds.source === "osmose")
			.forEach(ds => project.osmoseLabels[`${ds.item}_${ds.class || "all"}`] = ds.name);
		project.idParams = queryParams(Object.assign({}, project.editors.all, project.editors.iD));
		project.josmParams = queryParams(Object.assign({ changeset_comment: project.editors.all.comment, changeset_hashtags: project.editors.all.hashtags }, project.editors.JOSM));

		projects[project.id] = project;
	}
	catch(e) {
		console.error("Invalid project", projectDir, e);
	}
});

module.exports = projects;
