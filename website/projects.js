const fs = require('fs');
const { queryParams } = require('./utils');
const marked = require('marked');
const PROJECTS_PATH = __dirname + '/../projects';

const projects = {};
fs.readdirSync(PROJECTS_PATH).forEach(projectDir => {
	try {
		const project = JSON.parse(fs.readFileSync(PROJECTS_PATH + '/' + projectDir + '/info.json'));
		project.howto = marked(fs.readFileSync(PROJECTS_PATH + '/' + projectDir + '/howto.md', "utf8"));

		// Add auto-computed metadata
		project.osmoseLabels = {};
		project.osmoseButtons = {};
		project.datasources
			.filter(ds => ds.source === "osmose")
			.forEach(ds => {
				project.osmoseLabels[`${ds.item}_${ds.class || "all"}`] = {
					name: ds.name,
					subtitles: ds.subtitles
				};
				project.osmoseButtons[`${ds.item}_${ds.class || "all"}`] = ds.buttons;
			});
		project.idParams = queryParams(Object.assign({}, project.editors.all, project.editors.iD));
		project.josmParams = queryParams(Object.assign({ changeset_comment: project.editors.all.comment, changeset_hashtags: project.editors.all.hashtags }, project.editors.JOSM));

		projects[project.id] = project;
	}
	catch(e) {
		console.error("Invalid project", projectDir, e);
	}
});

module.exports = projects;
