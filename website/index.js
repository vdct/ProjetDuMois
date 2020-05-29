/**
 * API main code
 */

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const projects = require('./projects');
const pastProjects = Object.entries(projects)
	.filter(p => typeof p[1] === "object" && p[1].id !== projects.current)
	.map(p => ({ id: p[1].id, label: `${new Date(p[1].start_date).toLocaleDateString('fr-FR', { year: 'numeric', month: 'numeric' })} - ${p[1].title}` }));


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
	res.render('index', Object.assign({ past: pastProjects }, projects[projects.current]));
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
