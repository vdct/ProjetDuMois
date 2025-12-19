const fs = require('fs');
const { queryParams } = require('./utils');
const marked = require('marked').marked;
const PROJECTS_PATH = __dirname + '/../projects';
const fetch = require('node-fetch').default;

const projects = {};
fs.readdirSync(PROJECTS_PATH).forEach(projectDir => {
	try {
		const project = JSON.parse(fs.readFileSync(PROJECTS_PATH + '/' + projectDir + '/info.json'));
		project.howto = marked(fs.readFileSync(PROJECTS_PATH + '/' + projectDir + '/howto.md', "utf8"));
		project.month = project.name.split("_").shift()+"-05T00:00:00Z";
		project.slug = project.name.split("_").pop();

		// Filtered features
		let tagFilterParts = project.database.osmium_tag_filter.split("&");
		project.database.tagFilterFeatures = "nwr";
    	tagFilterParts.forEach(tagFilter => {
			if (tagFilter.indexOf('/') > -1){
				project.database.tagFilterFeatures = (project.database.tagFilterFeatures.match(new RegExp('[' + tagFilter.split('/').shift() + ']', 'g')) || []).join('');
			}
		});

		// Add auto-computed metadata
		project.osmoseLabels = {};
		project.osmoseButtons = {};
		project.datasources
			.filter(ds => ds.source === "osmose")
			.forEach(ds => {
				project.osmoseLabels[`${ds.item}_${ds.class || "all"}`] = {
					name: ds.name,
					subtitles: ds.subtitles,
					description: ds.description
				};
				project.osmoseButtons[`${ds.item}_${ds.class || "all"}`] = ds.buttons;
			});
		project.idParams = queryParams(Object.assign({}, project.editors.all, project.editors.iD));
		project.josmParams = queryParams(Object.assign({ changeset_comment: project.editors.all.comment, changeset_hashtags: project.editors.all.hashtags.split(",").join(" #") }, project.editors.JOSM));
		project.icon = `/images/badges/${projectDir.split("_").pop()}.svg`;

		// Replace NSI editors fields by actual value
		if(project.editors && project.editors.pdm && project.editors.pdm.fields) {
			project.editors.pdm.fields.map(async (f, id) => {
				if(f.type === "nsi") {
					const nsi = await (await fetch(`https://github.com/osmlab/name-suggestion-index/raw/main/data/${f.path}.json`)).json();
					f.type = "select";
					f.tag = "_select"+id;

					f.values = nsi.items
						.filter(it => !f.locationSet || !it.locationSet || !it.locationSet.include || it.locationSet.include.includes("001") || it.locationSet.include.includes(f.locationSet))
						.map(it => ({
							l: it.displayName,
							tags: it.tags
						}));

					delete f.path;
					delete f.locationSet;
				}

				return f;
			});
		}

		projects[project.name] = project; 
	}
	catch(e) {
		console.error("Invalid project", projectDir, e);
	}
});

module.exports = projects;
