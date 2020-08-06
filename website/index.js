/**
 * API main code
 */

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const fetch = require('node-fetch');
const projects = require('./projects');
const CONFIG = require('../config.json');
const { filterProjects, queryParams, getMapStyle } = require('./utils');
const { Pool } = require('pg');


/*
 * Connect to database
 */

const pool = new Pool({
  user: CONFIG.DB_USER,
  host: CONFIG.DB_HOST,
  database: CONFIG.DB_NAME,
  password: CONFIG.DB_PASS,
  port: CONFIG.DB_PORT,
});


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
	const p = filterProjects(projects);
	const destId = p.current ? p.current.id : p.past.pop().id;
	res.redirect(`/projects/${destId}`);
});

// Project page
app.get('/projects/:id', (req, res) => {
	if(!req.params.id || !projects[req.params.id]) {
		return res.status(404).send('Project ID not found');
	}

	const p = projects[req.params.id];
	const all = filterProjects(projects);
	const isActive = all.current && all.current.id === req.params.id;
	res.render('project', Object.assign({ CONFIG, isActive, projects: all }, p));
});

// Project map editor
app.get('/projects/:id/map', (req, res) => {
	if(!req.params.id || !projects[req.params.id]) {
		return res.status(404).send('Project ID not found');
	}

	const p = projects[req.params.id];
	const mapstyle = getMapStyle(p);
	res.render('map_page', Object.assign({ mapstyle, CONFIG }, p));
});

// Project statistics
app.get('/projects/:id/stats', (req, res) => {
	if(!req.params.id || !projects[req.params.id]) {
		return res.status(404).send('Project ID not found');
	}

	const p = projects[req.params.id];
	const allPromises = [];
	const osmUserAuthentified = typeof req.query.osm_user === "string" && req.query.osm_user.trim().length > 0;

	// Fetch Osmose statistics
	allPromises.push(Promise.all(p.datasources
	.filter(ds => ds.source === "osmose")
	.map(ds => {
		const params = { item: ds.item, class: ds.class, start_date: p.start_date, end_date: p.end_date, country: ds.country };
		return fetch(`${CONFIG.OSMOSE_URL}/fr/errors/graph.json?${queryParams(params)}`)
		.then(res => res.json())
		.then(res => ({
			label: ds.name,
			data: Object.entries(res.data)
				.map(e => ({ t: e[0], y: e[1] }))
				.sort((a,b) => a.t.localeCompare(b.t)),
			fill: false,
			borderColor: ds.color || "red"
		}));
	}))
	.then(results => {
		const nbTasksStart = results.map(r => r.data[0].y).reduce((acc,cur) => acc + cur);
		const nbTasksEnd = results.map(r => r.data[r.data.length-1].y).reduce((acc,cur) => acc + cur);

		return {
			chart: results,
			pctTasksDone: Math.floor(100 - nbTasksEnd / nbTasksStart * 100)
		};
	}));

	// Fetch feature counts
	if(p.count) {
		allPromises.push(pool.query(`
			SELECT ts, amount
			FROM feature_counts
			WHERE project = $1
		`, [req.params.id])
		.then(results => ({
			chart: [{
				label: "Nombre dans OSM",
				data: results.rows.map(r => ({ t: r.ts, y: r.amount })),
				fill: false,
				borderColor: "blue"
			}]
		})));
	}

	// Fetch user statistics from DB
	allPromises.push(pool.query(`
		SELECT uc.userid, un.username, ub.badges, COUNT(*) AS amount
		FROM user_contributions uc
		JOIN user_names un ON uc.userid = un.userid
		LEFT JOIN (
			SELECT userid, array_agg(badge) AS badges
			FROM user_badges
			WHERE project = $1
			GROUP BY userid
		) ub ON uc.userid = ub.userid
		WHERE uc.project = $1
		GROUP BY uc.userid, un.username, ub.badges
		ORDER BY COUNT(*) DESC
	`, [req.params.id])
	.then(results => ({
		nbContributors: results.rows.length,
		leaderboard: osmUserAuthentified ? results.rows : null
	})));

	Promise.all(allPromises)
	.then(results => {
		let toSend = {};
		results.forEach(r => {
			Object.entries(r).forEach(e => {
				if(!toSend[e[0]]) { toSend[e[0]] = e[1]; }
				else if(e[0] === "chart") { toSend.chart = toSend.chart.concat(e[1]); }
			});
		});
		res.send(toSend);
	});
});

// Documentation
['README.md', 'DEVELOP.md', 'LICENSE.txt'].forEach(file => {
	app.get(`/${file}`, (req, res) => {
		res.sendFile(path.join(__dirname, '..', file));
	});
});

// Images
app.use('/images', express.static(__dirname+'/images'));

// Libraries
app.get('/lib/:modname/:file', (req, res) => {
	const authorized = {
		"bootstrap": {
			"bootstrap.css": "dist/css/bootstrap.min.css"
		},
		"mapbox-gl": {
			"mapbox-gl.js": "dist/mapbox-gl.js",
			"mapbox-gl.css": "dist/mapbox-gl.css"
		},
		"chart.js": {
			"chart.js": "dist/Chart.bundle.min.js",
			"chart.css": "dist/Chart.min.css"
		},
		"osm-auth": {
			"osmauth.js": "osmauth.min.js"
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
