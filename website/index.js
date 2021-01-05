/**
 * API main code
 */

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const projects = require('./projects');
const CONFIG = require('../config.json');
const { filterProjects, queryParams, getMapStyle, getBadgesDetails } = require('./utils');
const { Pool } = require('pg');
const { I18n } = require('i18n');


/*
 * Connect to database
 */

const pool = new Pool({
  host: CONFIG.DB_HOST,
  database: CONFIG.DB_NAME,
  port: CONFIG.DB_PORT,
});


/*
 * Internationalization
 */

const i18n = new I18n({
	locales: ['fr', 'en'],
	directory: path.join(__dirname, 'locales'),
	autoReload: true,
	defaultLocale: 'fr',
	retryInDefaultLocale: true
});


/*
 * Init API
 */

const app = express();
const port = process.env.PORT || 3000;
app.use(cors());
app.options('*', cors());
app.use(compression());
app.use(i18n.init);
app.use(function(req, res, next) {
	res.locals.__ = res.__ = function() {
		return i18n.__.apply(req, arguments);
	};
	next();
});

app.set('view engine', 'pug');
app.set('views', __dirname+'/templates');

// Index
app.get('/', (req, res) => {
	const p = filterProjects(projects);
	const destId = p.current ? p.current.id : (p.next ? p.next.id : (p.past.length > 0 ? p.past.pop().id : null));
	if(destId) {
		res.redirect(`/projects/${destId}`);
	}
	else {
		res.redirect('/error/500');
	}
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
	const isRecentPast = all.past && all.past.length > 0 && all.past[all.past.length-1].id === req.params.id && new Date(p.end_date+"T23:59:59Z").getTime() >= Date.now() - 30*24*60*60*1000;
	res.render('pages/project', Object.assign({ CONFIG, isActive, isNext, isRecentPast, projects: all }, p));
});

// Project map editor
app.get('/projects/:id/map', async (req, res) => {
	if(!req.params.id || !projects[req.params.id]) {
		return res.redirect('/error/404');
	}

	const p = projects[req.params.id];
	const all = filterProjects(projects);
	const isActive = all.current && all.current.id === req.params.id;
	const mapstyle = await getMapStyle(p);
	res.render('pages/map', Object.assign({ CONFIG, isActive }, p, mapstyle));
});

// Project notes list
app.get('/projects/:id/issues', (req, res) => {
	if(!req.params.id || !projects[req.params.id]) {
		return res.redirect('/error/404');
	}

	const p = projects[req.params.id];
	const all = filterProjects(projects);
	const isActive = all.current && all.current.id === req.params.id;
	res.render('pages/issues', Object.assign({ CONFIG, isActive }, p));
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
			borderColor: ds.color || "#c62828",
			lineTension: 0
		}));
	}))
	.then(results => {
		if(!results || results.length === 0 || results.filter(r => r.data && r.data.length > 0).length === 0) { return {}; }

		const nbTasksStart = results.map(r => r.data[0].y).reduce((acc,cur) => acc + cur);
		const nbTasksEnd = results.map(r => r.data[r.data.length-1].y).reduce((acc,cur) => acc + cur);

		return {
			chart: results,
			tasksSolved: nbTasksStart - nbTasksEnd > 0 ? nbTasksStart - nbTasksEnd : undefined
		};
	}));

	// Fetch notes counts
	if(p.datasources.find(ds => ds.source === "notes")) {
		allPromises.push(pool.query(`
			SELECT ts, open, closed
			FROM pdm_note_counts
			WHERE project = $1
			ORDER BY ts ASC
		`, [req.params.id])
		.then(results => ({
			chartNotes: [
				{
					label: "Ouvertes",
					data: results.rows.map(r => ({ t: r.ts, y: r.open })),
					fill: false,
					borderColor: "#c62828",
					lineTension: 0
				},
				{
					label: "Résolues",
					data: results.rows.map(r => ({ t: r.ts, y: r.closed })),
					fill: false,
					borderColor: "#388E3C",
					lineTension: 0
				}
   			],
			pctClosedNotes: results.rows.length > 0 && (results.rows[results.rows.length-1].closed / results.rows[results.rows.length-1].open * 100).toFixed(0),
			openedNotes: results.rows.length > 0 && results.rows[results.rows.length-1].open
		})));
	}

	// Fetch feature counts
	if(p.statistics.count) {
		allPromises.push(pool.query(`
			SELECT ts, amount
			FROM pdm_feature_counts
			WHERE project = $1
			ORDER BY ts ASC
		`, [req.params.id])
		.then(results => ({
			chart: [{
				label: "Nombre dans OSM",
				data: results.rows.map(r => ({ t: r.ts, y: r.amount })),
				fill: false,
				borderColor: "#388E3C",
				lineTension: 0
			}],
			added: results.rows.length > 0 && results.rows[results.rows.length-1].amount - results.rows[0].amount
		})));

		allPromises.push(pool.query(
			`SELECT COUNT(*) AS amount FROM pdm_project_${req.params.id.split("_").pop()}`
		).then(results => ({
			count: results.rows.length > 0 && results.rows[0].amount
		})));
	}

	// Fetch user statistics from DB
	allPromises.push(pool.query(`SELECT * FROM pdm_leaderboard WHERE project = $1 ORDER BY pos`, [req.params.id])
	.then(results => ({
		nbContributors: results.rows.length,
		leaderboard: osmUserAuthentified ? results.rows : null
	})));

	// Fetch tags statistics
	allPromises.push(pool.query(`
		SELECT k, COUNT(*) AS amount
		FROM (
			SELECT json_object_keys(tags) AS k
			FROM pdm_project_${req.params.id.split("_").pop()}
		) a
		GROUP BY k
		ORDER BY COUNT(*) desc;`
	)
	.then(results => {
		const d = results.rows.filter(r => r.amount >= (results.rows[0].amount / 10));
		return {
			chartKeys: {
				labels: d.map(r => r.k),
				datasets: [{
					label: "Nombre d'objets pour la clé",
					data: d.map(r => r.amount),
					fill: false,
					backgroundColor: "#1E88E5",
				}]
			}
		};
	}));

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

// User contributions
app.post('/projects/:id/contribute/:userid', (req, res) => {
	// Check project is active
	const p = filterProjects(projects);
	if(!req.params.id || !projects[req.params.id] || !p.current || p.current.id !== req.params.id) {
		return res.redirect('/error/400');
	}

	// Check userid seem valid
	if(!req.params.userid || !/^\d+$/.test(req.params.userid) || typeof req.query.username !== "string" || req.query.username.trim().length === 0) {
		return res.redirect('/error/400');
	}

	// Check type of contribution
	if(!req.query.type || !["add", "edit", "delete", "note"].includes(req.query.type)) {
		return res.redirect('/error/400');
	}

	// Update user name in DB
	pool.query('INSERT INTO pdm_user_names(userid, username) VALUES ($1, $2) ON CONFLICT (userid) DO UPDATE SET username = EXCLUDED.username', [req.params.userid, req.query.username])
	.then(r1 => {
		// Get badges before edit
		pool.query('SELECT * FROM pdm_get_badges($1, $2)', [req.params.id, req.params.userid])
		.then(r2 => {
			const badgesBefore = r2.rows;

			// Insert contribution
			pool.query('INSERT INTO pdm_user_contribs(project, userid, ts, contribution, verified, points) VALUES ($1, $2, current_timestamp, $3, false, get_points($1, $3))', [req.params.id, req.params.userid, req.query.type])
			.then(r3 => {
				// Get badges after contribution
				pool.query('SELECT * FROM pdm_get_badges($1, $2)', [req.params.id, req.params.userid])
				.then(r4 => {
					const badgesAfter = r4.rows;
					const badgesForDisplay = badgesAfter.filter(b => {
						const badgeInBefore = badgesBefore.find(b2 => b.id === b2.id);
						return !badgeInBefore || !b.acquired || badgeInBefore.acquired !== b.acquired;
					});
					res.send({ badges: badgesForDisplay });
				})
				.catch(e => {
					res.redirect('/error/500');
				});
			})
			.catch(e => {
				res.redirect('/error/500');
			});
		})
		.catch(e => {
			res.redirect('/error/500');
		});
	})
	.catch(e => {
		res.redirect('/error/500');
	});
});

// Add OSM feature to compare exclusion list
app.post('/projects/:id/ignore/:osmtype/:osmid', (req, res) => {
	// Check project exists
	if(!req.params.id || !projects[req.params.id]) {
		return res.redirect('/error/404');
	}
	// Check OSM ID
	if(!req.params.osmtype || !["node", "way", "relation"].includes(req.params.osmtype) || !req.params.osmid || !/^\d+$/.test(req.params.osmid)) {
		return res.redirect('/error/400');
	}

	pool.query('INSERT INTO pdm_compare_exclusions(project, osm_id, userid) VALUES ($1, $2, $3) ON CONFLICT (project, osm_id) DO UPDATE SET ts = current_timestamp, userid = $3', [req.params.id, req.params.osmtype+"/"+req.params.osmid, req.query.user_id])
	.then(() => {
		res.send();
	})
	.catch(e => {
		res.redirect('/error/500');
	});
});

// User page
app.get('/users/:name', (req, res) => {
	if(!req.params.name) {
		return res.redirect('/error/404');
	}

	// Find user in database
	pool.query(`SELECT userid FROM pdm_user_names WHERE username = $1`, [ req.params.name ])
	.then(res1 => {
		if(res1.rows.length === 1) {
			const userid = res1.rows[0].userid;

			// Fetch badges
			const sql = Object.entries(projects)
				.map(e => `SELECT '${e[0]}' AS project, * FROM pdm_get_badges('${e[0]}', $1)`)
				.concat([`SELECT 'meta' AS project, * FROM pdm_get_badges('meta', $1)`])
				.join(" UNION ALL ");

			pool.query(sql, [ userid ])
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
app.use('/website/images', express.static(__dirname+'/images'));

// Static content
fs.readdirSync(path.join(__dirname, 'static')).forEach(file => {
	app.get(`/${file}`, (req, res) => {
		if(file === "manifest.webmanifest") { res.contentType("application/manifest+json"); }
		res.sendFile(path.join(__dirname, 'static', file));
	});
});


// Libraries
const authorized = {
	"bootstrap": { "bootstrap.css": "dist/css/bootstrap.min.css" },
	"bootstrap.native": { "bootstrap.js": "dist/bootstrap-native.min.js" },
	"chart.js": {
		"chart.js": "dist/Chart.bundle.min.js",
		"chart.css": "dist/Chart.min.css"
	},
	"mapbox-gl": {
		"mapbox-gl.js": "dist/mapbox-gl.js",
		"mapbox-gl.css": "dist/mapbox-gl.css"
	},
	"osm-auth": { "osmauth.js": "osmauth.min.js" },
	"osm-request": { "osmrequest.js": "dist/OsmRequest.js" },
	"pic4carto": { "pic4carto.js": "dist/P4C.min.js" },
	"swiped-events": { "swiped-events.js": "dist/swiped-events.min.js" },
	"wordcloud": { "wordcloud.js": "src/wordcloud2.js" }
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
