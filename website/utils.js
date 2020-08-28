const CONFIG = require('../config.json');

// Get current+past projects
exports.filterProjects = (projects) => {
	const prjs = { past: [], current: null, next: null };
	Object.values(projects).forEach(project => {
		// Check dates
		if(new Date(project.start_date).getTime() <= Date.now() && Date.now() <= new Date(project.end_date).getTime()) {
			prjs.current = project;
		}
		else if(Date.now() <= new Date(project.start_date).getTime()) {
			prjs.next = project;
		}
		else if(new Date(project.end_date).getTime() < Date.now()) {
			prjs.past.push({
				id: project.id,
				icon: `/images/badges/${project.id.split("_").pop()}.svg`,
				title: project.title,
				month: project.month
			});
		}
	});
	return prjs;
};

// Object into URL parameters
exports.queryParams = (obj) => {
	return Object.entries(obj)
		.filter(e => e[0] && e[1])
		.map(e => e[0]+"="+encodeURIComponent(e[1])).join("&");
};

// Map style JSON
exports.getMapStyle = (p) => {
	const legend = [];
	const sources = { osm: {
		type: "raster",
		tiles: [ "https://tile.openstreetmap.org/{z}/{x}/{y}.png" ],
		maxzoom: 19,
		attribution: "&copy; OpenStreetMap"
	}};
	const layers = [{
		id: "osm",
		source: "osm",
		type: "raster"
	}];

	if(p) {
		const circlePaint = {
			"circle-color": "white",
			"circle-stroke-opacity": [ "interpolate", ["linear"], ["zoom"], 7, 0, 7.5, 1 ],
			"circle-opacity": [ "interpolate", ["linear"], ["zoom"], 7, 0, 7.5, 1 ],
			"circle-radius": [
				"interpolate",
				["linear"],
				["zoom"],
				7, 2,
				11, 3,
				19, 7
			],
			"circle-stroke-width": [
				"interpolate",
				["linear"],
				["zoom"],
				7, 2,
				11, 3,
				19, 7
			]
		};

		// OSM Compare
		p.datasources
		.filter(ds => "osm-compare" === ds.source)
		.forEach((ds, dsid) => {
			const id = `${ds.source}_${dsid}`;
			const color = ds.color || "#FF7043"; // Orange
			const layer = `public.project_${p.id.split("_").pop()}_compare_tiles`;
			sources[id] = {
				type: "vector",
				tiles: [ `${CONFIG.PDM_TILES_URL}/${layer}/{z}/{x}/{y}.mvt` ],
				minzoom: 9,
				maxzoom: 14
			};

			layers.push({
				id: id,
				source: id,
				type: "circle",
				"source-layer": layer,
				paint: {
					"circle-color": color,
					"circle-opacity": [ "interpolate", ["linear"], ["zoom"], 9, 0, 10, 1 ],
					"circle-radius": [ "interpolate", ["linear"], ["zoom"], 9, 2, 11, 3, 13, 5, 19, 12 ]
				}
			});

			legend.push({ color, label: ds.name });
		});

		// OSM
		p.datasources
		.filter(ds => "osm" === ds.source)
		.forEach((ds, dsid) => {
			const id = `${ds.source}_${dsid}`;
			const color = ds.color || "#2E7D32"; // Green
			const layer = `public.project_${p.id.split("_").pop()}`;
			sources[id] = {
				type: "vector",
				tiles: [ `${CONFIG.PDM_TILES_URL}/${layer}/{z}/{x}/{y}.mvt` ],
				minzoom: 7,
				maxzoom: 14
			};

			layers.push({
				id: id,
				source: id,
				type: "circle",
				"source-layer": layer,
				paint: Object.assign({ "circle-stroke-color": color }, circlePaint)
			});

			legend.push({ color, label: ds.name });
		});

		// Osmose
		p.datasources
		.filter(ds => ds.source === "osmose")
		.forEach(ds => {
			const id = `osmose_${ds.item}_${ds.class || "all"}`;
			const params = { item: ds.item, class: ds.class, country: ds.country };
			const color = ds.color || "#b71c1c"; // Red

			sources[id] = {
				type: "vector",
				tiles: [ `${CONFIG.OSMOSE_URL}/api/0.3/issues/{z}/{x}/{y}.mvt?${exports.queryParams(params)}` ],
				minzoom: 7,
				maxzoom: 18
			};

			layers.push({
				id: id,
				source: id,
				type: "circle",
				"source-layer": "issues",
				paint: Object.assign({ "circle-stroke-color": color }, circlePaint)
			});

			legend.push({ color, label: ds.name });
		});

		// Notes
		p.datasources
		.filter(ds => ds.source === "notes")
		.forEach((ds, dsid) => {
			const id = `notes_${dsid}`;
			const color = ds.color || "#01579B"; // Blue
			sources[id] = { type: "geojson", data: { type: "FeatureCollection", features: [] } };

			layers.push({
				id: id,
				source: id,
				type: "circle",
				paint: Object.assign({ "circle-stroke-color": color }, circlePaint)
			});

			legend.push({ color, label: ds.name });
		});
	}

	return {
		mapstyle: {
			version: 8,
			name: "ProjetDuMois.fr",
			sources: sources,
			layers: layers
		},
		legend
	};
};

// Get badges description
exports.getBadgesDetails = (projects, badgesRows) => {
	const badges = { "meta": { project: { name: "Général", image: "/images/favicon.svg" }, badges: [] } };
	badgesRows.forEach(row => {
		if(!badges[row.project]) {
			badges[row.project] = {
				project: { name: projects[row.project].title, date: projects[row.project].month, image: projects[row.project].icon },
				badges: [{ id: row.project.split("_").pop(), name: "A participé", description: "A participé au projet du mois", acquired: true, progress: 100 }]
			};
		}

		if(row.project === "meta" || row.acquired || new Date(projects[row.project].start_date).getTime() <= Date.now() && Date.now() <= new Date(projects[row.project].end_date).getTime()) {
			badges[row.project].badges.push(row);
		}
	});

	// Meta badges
	if(Object.keys(badges).length - 1 === Object.keys(projects).length) {
		badges.meta.badges.push({ id: "all", name: "Toujours là", description: "A participé à tous les projets du mois", acquired: true, progress: 100 });
	}
	if(badges.meta.badges.length === 0) {
		delete badges.meta;
	}

	return badges;
};
