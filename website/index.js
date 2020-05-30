/**
 * API main code
 */

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const projects = require('./projects');
const CONFIG = require('../config.json');

// Get current+past projects
function filterProjects() {
	const prjs = { past: [], current: null };
	Object.values(projects).forEach(project => {
		// Check dates
		if(new Date(project.start_date).getTime() <= Date.now() && Date.now() <= new Date(project.end_date).getTime()) {
			prjs.current = project;
		}
		else {
			prjs.past.push({
				id: project.id,
				label: `${new Date(project.start_date).toLocaleDateString('fr-FR', { year: 'numeric', month: 'numeric' })} - ${project.title}`
			});
		}
	});
	return prjs;
}


/*
 * Init API
 */

const app = express();
const port = process.env.PORT || 3000;
app.use(cors());
app.options('*', cors());
app.use(compression());
app.set('view engine', 'pug');
app.set('views', __dirname+'/templates');

// Index
app.get('/', (req, res) => {
	const p = filterProjects();
	res.render('index', Object.assign({ past: p.past }, p.current));
});

// Mapbox GL style
app.get('/mapstyle.json', (req, res) => {
	const osmoseSources = {};
	const osmoseLayers = [];
	const p = filterProjects();

	if(p.current) {
		p.current.datasources
		.filter(ds => ds.source === "osmose")
		.forEach(ds => {
			const id = `osmose_${ds.item}_${ds.class}`;

			osmoseSources[id] = {
				type: "vector",
				tiles: [ `${CONFIG.OSMOSE_URL}/api/0.3beta/issues/{z}/{x}/{y}.mvt?item=${ds.item}${ds.class ? "&class="+ds.class : ""}` ],
				minzoom: 7
			};

			osmoseLayers.push({
				id: id,
				source: id,
				type: "circle",
				"source-layer": "issues",
				paint: {
					"circle-color": ds.color || "red",
					"circle-radius": [
						"interpolate",
						["linear"],
						["zoom"],
						11, 3,
						19, 13
					]
				}
			});
		});
	}

	res.json({
		version: 8,
		name: "ProjetDuMois.fr",
		sources: Object.assign({
			osm: {
				type: "raster",
				tiles: [ "https://tile.openstreetmap.org/{z}/{x}/{y}.png" ],
				maxzoom: 19,
				attribution: "&copy; OpenStreetMap"
			}
		}, osmoseSources),
		layers: [
			{
				id: "osm",
				source: "osm",
				type: "raster"
			}
		].concat(osmoseLayers)
	});
});

// Documentation
['README.md', 'DEVELOP.md', 'LICENSE.txt'].forEach(file => {
	app.get(`/${file}`, (req, res) => {
		res.sendFile(path.join(__dirname, '..', file));
	});
});

// Libraries
app.get('/lib/:modname/:file', (req, res) => {
	const authorized = {
		"bootstrap": {
			"bootstrap.css": "dist/css/bootstrap.min.css"
		},
		"mapbox-gl": {
			"mapbox-gl.js": "dist/mapbox-gl.js",
			"mapbox-gl.css": "dist/mapbox-gl.css"
		}
	};

	if(!req.params.modname || !req.params.file) {
		return res.status(400).send('Missing parameters');
	}
	else if(!authorized[req.params.modname] || !authorized[req.params.modname][req.params.file]) {
		return res.status(404).send('File not found');
	}

	const options = {
		root: path.join(__dirname, '../node_modules'),
		dotfiles: 'deny',
		headers: {
			'x-timestamp': Date.now(),
			'x-sent': true
		}
	};

	const fileName = `${req.params.modname}/${authorized[req.params.modname][req.params.file]}`;
	res.sendFile(fileName, options, (err) => {
		if (err) {
			res.status(500).send('Error when retrieving file');
		}
	});
});

// 404
app.use((req, res) => {
	res.status(404).send(req.originalUrl + ' not found')
});

// Start
app.listen(port, () => {
	console.log('API started on port: ' + port);
});
