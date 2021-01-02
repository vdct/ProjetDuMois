const CONFIG = require('../config.json');
const fetch = require('node-fetch');

// Get current+past projects (deprecated)
exports.filterProjects = (projects) => {
	const prjs = { past: [], current: null, next: null };
	Object.values(projects).forEach(project => {
		// Check dates
		if(new Date(project.start_date).getTime() <= Date.now() && Date.now() <= new Date(project.end_date+"T23:59:59Z").getTime()) {
			prjs.current = project;
		}
		else if(Date.now() <= new Date(project.start_date).getTime()) {
			prjs.next = project;
		}
		else if(new Date(project.end_date+"T23:59:59Z").getTime() < Date.now()) {
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

// Get current+past projects 
exports.foldProjects = (projects) => {
	const prjs = { past: [], current: [], next: [] };
	Object.values(projects).forEach(project => {
		// Check dates
		if(new Date(project.start_date).getTime() <= Date.now() && Date.now() <= new Date(project.end_date+"T23:59:59Z").getTime()) {
			prjs.current.push(project);
		}
		else if(Date.now() <= new Date(project.start_date).getTime()) {
			prjs.next.push(project);
		}
		else if(new Date(project.end_date+"T23:59:59Z").getTime() < Date.now()) {
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
	return fetch("https://tile-vect.openstreetmap.fr/styles/liberty/style.json")
	.then(res => res.json())
	.then(style => {
		const legend = [];
		let vectorMinZoom = 50;
		const sources = {
			ign: {
				type: "raster",
				tiles: [ "https://proxy-ign.openstreetmap.fr/94GjiyqD/bdortho/{z}/{x}/{y}.jpg" ],
				maxzoom: 19,
				minzoom: 2,
				tileSize: 256,
				attribution: `<a href="https://openstreetmap.fr/bdortho" target="_blank">&copy; BDOrtho IGN</a>`
			}
		};
		const layers = [
			{ id: "bg_aerial", source: "ign", type: "raster", layout: { visibility: "none" } }
		];

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
				const layer = `public.pdm_project_${p.id.split("_").pop()}_compare_tiles_filtered`;
				let minZoom = ds.hasOwnProperty("minZoom") && ds.minZoom > 0 ? ds.minZoom : 9
				vectorMinZoom = Math.min(vectorMinZoom, minZoom);
				sources[id] = {
					type: "vector",
					tiles: [ `${CONFIG.PDM_TILES_URL}/${layer}/{z}/{x}/{y}.mvt` ],
					minzoom: minZoom,
					maxzoom: ds.hasOwnProperty("maxZoom") && ds.maxZoom > 0 ? ds.maxZoom : 14
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

				legend.push({ color, label: ds.name, layerId: id });
			});

			// OSM
			p.datasources
			.filter(ds => "osm" === ds.source)
			.forEach((ds, dsid) => {
				const id = `${ds.source}_${dsid}`;
				const color = ds.color || "#2E7D32"; // Green
				const layer = `public.pdm_project_${p.id.split("_").pop()}`;
				let minZoom = ds.hasOwnProperty("minZoom") && ds.minZoom > 0 ? ds.minZoom : 7
				vectorMinZoom = Math.min(vectorMinZoom, minZoom);
				sources[id] = {
					type: "vector",
					tiles: [ `${CONFIG.PDM_TILES_URL}/${layer}/{z}/{x}/{y}.mvt` ],
					minzoom: minZoom,
					maxzoom: ds.hasOwnProperty("maxZoom") && ds.maxZoom > 0 ? ds.maxZoom : 14
				};

				layers.push({
					id: id,
					source: id,
					type: "circle",
					"source-layer": layer,
					paint: Object.assign({ "circle-stroke-color": color }, circlePaint)
				});

				legend.push({ color, label: ds.name, layerId: id });
			});

			// Osmose
			p.datasources
			.filter(ds => ds.source === "osmose")
			.forEach(ds => {
				const id = `${ds.source}_${ds.item}_${ds.class || "all"}`;
				const params = { item: ds.item, class: ds.class, country: ds.country };
				const color = ds.color || "#b71c1c"; // Red
				let minZoom = ds.hasOwnProperty("minZoom") && ds.minZoom > 0 ? ds.minZoom : 7
				vectorMinZoom = Math.min(vectorMinZoom, minZoom);

				sources[id] = {
					type: "vector",
					tiles: [ `${CONFIG.OSMOSE_URL}/api/0.3/issues/{z}/{x}/{y}.mvt?${exports.queryParams(params)}` ],
					minzoom: minZoom,
					maxzoom: ds.hasOwnProperty("maxZoom") && ds.maxZoom > 0 ? ds.maxZoom : 18
				};

				layers.push({
					id: id,
					source: id,
					type: "circle",
					"source-layer": "issues",
					paint: Object.assign({ "circle-stroke-color": color }, circlePaint)
				});

				legend.push({ color, label: ds.name, layerId: id });
			});

			// Notes
			p.datasources
			.filter(ds => ds.source === "notes")
			.forEach((ds, dsid) => {
				const id = `${ds.source}_${dsid}`;
				const color = ds.color || "#01579B"; // Blue
				sources[id] = { type: "geojson", data: { type: "FeatureCollection", features: [] } };

				layers.push({
					id: id,
					source: id,
					type: "circle",
					paint: Object.assign({ "circle-stroke-color": color }, circlePaint)
				});

				legend.push({ color, label: ds.name, layerId: id });
			});
		}

		style.sources = Object.assign(style.sources, sources);
		style.layers = style.layers.concat(layers);

		return {
			mapstyle: style,
			minZoom: vectorMinZoom,
			legend,
			pdmSources: Object.keys(sources)
		};
	});
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
