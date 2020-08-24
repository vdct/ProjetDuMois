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
const { filterProjects, queryParams, getMapStyle, getBadgesDetails } = require('./utils');
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
	const destId = p.current ? p.current.id : (p.next ? p.next.id : p.past.pop().id);
	res.redirect(`/projects/${destId}`);
});

// HTTP errors
app.get('/error/:code', (req, res) => {
	const httpcode = req.params.code && !isNaN(req.params.code) ? req.params.code : "400";
	res.status(httpcode).render('pages/error', { CONFIG, httpcode });
});

// Project page
app.get('/projects/:id', (req, res) => {
	if(!req.params.id || !projects[req.params.id]) {
		return res.redirect('/error/404');
	}

	const p = projects[req.params.id];
	const all = filterProjects(projects);
	const isActive = all.current && all.current.id === req.params.id;
	const isNext = all.next && all.next.id === req.params.id;
	res.render('pages/project', Object.assign({ CONFIG, isActive, isNext, projects: all }, p));
});

// Project map editor
app.get('/projects/:id/map', (req, res) => {
	if(!req.params.id || !projects[req.params.id]) {
		return res.redirect('/error/404');
	}

	const p = projects[req.params.id];
	const mapstyle = getMapStyle(p);
	res.render('pages/map', Object.assign({ CONFIG }, p, mapstyle));
});

// Project statistics
app.get('/projects/:id/stats', (req, res) => {
	if(!req.params.id || !projects[req.params.id]) {
		return res.redirect('/error/404');
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
			borderColor: ds.color || "red",
			lineTension: 0
		}));
	}))
	.then(results => {
		if(!results || results.length === 0 || results.filter(r => r.data && r.data.length > 0).length === 0) { return {}; }

		const nbTasksStart = results.map(r => r.data[0].y).reduce((acc,cur) => acc + cur);
		const nbTasksEnd = results.map(r => r.data[r.data.length-1].y).reduce((acc,cur) => acc + cur);

		return {
			chart: results,
			pctTasksDone: Math.floor(100 - nbTasksEnd / nbTasksStart * 100)
		};
	}));

	// Fetch notes counts
	if(p.datasources.find(ds => ds.source === "notes")) {
		allPromises.push(pool.query(`
			SELECT ts, open, closed
			FROM note_counts
			WHERE project = $1
			ORDER BY ts
		`, [req.params.id])
		.then(results => ({
			chartNotes: [
				{
					label: "Ouvertes",
					data: results.rows.map(r => ({ t: r.ts, y: r.open })),
					fill: false,
					borderColor: "red",
					lineTension: 0
				},
				{
					label: "Résolues",
					data: results.rows.map(r => ({ t: r.ts, y: r.closed })),
					fill: false,
					borderColor: "green",
					lineTension: 0
				}
   			],
			closedNotes: results.rows.length > 0 && results.rows[results.rows.length-1].closed
		})));
	}

	// Fetch feature counts
	if(p.statistics.count) {
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
				borderColor: "blue",
				lineTension: 0
			}],
			count: results.rows.length > 0 && results.rows[results.rows.length-1].amount
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

// User page
app.get('/users/:name', (req, res) => {
	if(!req.params.name) {
		return res.redirect('/error/404');
	}

	// Find user in database
	pool.query(`SELECT userid FROM user_names WHERE username = $1`, [ req.params.name ])
	.then(res1 => {
		if(res1.rows.length === 1) {
			const userid = res1.rows[0].userid;

			// Fetch badges
			pool.query("SELECT project, badge FROM user_badges WHERE userid = $1", [ userid ])
			.then(res2 => {
				res.render('pages/user', { CONFIG, username: req.params.name, userid, badges: getBadgesDetails(projects, res2.rows) });
			})
			.catch(e => {
				res.redirect('/error/500');
			});
		}
		else {
			res.redirect('/error/404');
		}
	})
	.catch(e => {
		res.redirect('/error/500');
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
const authorized = {
	"bootstrap": {
		"bootstrap.css": "dist/css/bootstrap.min.css"
	},
	"bootstrap.native": {
		"bootstrap.js": "dist/bootstrap-native.min.js"
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
	},
	"osm-request": {
		"osmrequest.js": "dist/OsmRequest.js"
	}
};

app.get('/lib/:modname/:file', (req, res) => {
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

app.use('/lib/fontawesome', express.static(path.join(__dirname, '../node_modules/@fortawesome/fontawesome-free')));

// 404
app.use((req, res) => {
	res.redirect('/error/404');
});

// Start
app.listen(port, () => {
	console.log('API started on port: ' + port);
});
