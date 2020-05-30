const fs = require('fs');
const PROJECTS_PATH = __dirname + '/../projects';

const projects = {};
fs.readdirSync(PROJECTS_PATH).forEach(projectDir => {
	try {
		const project = JSON.parse(fs.readFileSync(PROJECTS_PATH + '/' + projectDir + '/info.json'));
		projects[project.id] = project;
	}
	catch(e) {
		console.error("Invalid project", projectDir, e);
	}
});

module.exports = projects;
