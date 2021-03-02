const CONFIG = require('../config.json');
const fetch = require('node-fetch');
const tag2link = require('tag2link');

function flatten(array) {
	if(array.length == 0)
		return array;
	else if(Array.isArray(array[0]))
		return flatten(array[0]).concat(flatten(array.slice(1)));
	else
		return [array[0]].concat(flatten(array.slice(1)));
}

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
	return fetch(CONFIG.MAPBOX_STYLE)
	.then(res => res.json())
	.then(style => {
		const legend = [];
		let vectorMinZoom = 50;
		let sources = {};
		let layers = [];

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

			// Backgrounds
			p.datasources
			.filter(ds => "background" === ds.source)
			.forEach((ds, dsid) => {
				const id = `${ds.source}_${dsid}`;

				sources[id] = Object.assign({
					minZoom: 2,
					maxZoom: 19,
					tileSize: 256,
					type: "raster"
				}, ds);

				layers.push({
					id: id,
					source: id,
					type: "raster",
					layout: { visibility: "none" }
				});

				legend.push({ media: "raster", color:null, label: ds.name, layerId: id, icon: ds.icon });
			});

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

				legend.push({ media: "vector", color, label: ds.name, layerId: id });
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

				legend.push({ media: "vector", color, label: ds.name, layerId: id });
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

				legend.push({ media: "vector", color, label: ds.name, layerId: id });
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

				legend.push({ media: "vector", color, label: ds.name, layerId: id });
			});
		}

		style.sources = Object.assign(style.sources, sources);
		style.layers = style.layers.concat(layers);

		return {
			mapstyle: style,
			minZoom: vectorMinZoom,
			legend: legend.reverse(),
			pdmSources: Object.keys(sources)
		};
	});
};

// Map style JSON for statistics
exports.getMapStatsStyle = (p, maxPerLevel) => {
	return fetch(CONFIG.MAPBOX_STYLE)
	.then(res => res.json())
	.then(style => {
		let sources = {};
		let layers = [];
		const legend = {
			"4": { color: "#2196F3", minSize: 3, minValue: 1, maxSize: 30, maxValue: maxPerLevel["4"] },
			"6": { color: "#4A148C", minSize: 3, minValue: 1, maxSize: 35, maxValue: maxPerLevel["6"] },
			"8": { color: "#004D40", minSize: 3, minValue: 1, maxSize: 40, maxValue: maxPerLevel["8"] }
		};

		if(p && p.statistics && p.statistics.count) {
			sources.boundary = {
				type: "vector",
				tiles: [ `${CONFIG.PDM_TILES_URL}/public.pdm_boundary_tiles/{z}/{x}/{y}.mvt` ],
				maxzoom: 14
			};

			const condOpacity = ["interpolate", ["linear"], ["zoom"],
				4.9, ["case", ["all", ["==", ["get", "project"], p.id], ["==", ["get", "admin_level"], 4]], 1, 0 ],
				5, 0,
				5.1, ["case", ["all", ["==", ["get", "project"], p.id], ["==", ["get", "admin_level"], 6]], 1, 0 ],
				7.9, ["case", ["all", ["==", ["get", "project"], p.id], ["==", ["get", "admin_level"], 6]], 1, 0 ],
				8, 0,
				8.1, ["case", ["all", ["==", ["get", "project"], p.id], ["==", ["get", "admin_level"], 8]], 1, 0 ]
			];

			layers.push({
				id: "boundary",
				source: "boundary",
				type: "circle",
				"source-layer": "public.pdm_boundary_tiles",
				layout: {
					"circle-sort-key": ["-", ["get", "nb"]]
				},
				paint: {
					"circle-stroke-color": "white",
					"circle-stroke-width": 2,
					"circle-stroke-opacity": condOpacity,
					"circle-color": ["match", ["get", "admin_level"], 4, legend["4"].color, 6, legend["6"].color, legend["8"].color],
					"circle-opacity": condOpacity,
					"circle-radius": ["match", ["get", "admin_level"],
						4, ["interpolate", ["linear"], ["get", "nb"], 0, 0, legend["4"].minValue, legend["4"].minSize, legend["4"].maxValue, legend["4"].maxSize],
						6, ["interpolate", ["linear"], ["get", "nb"], 0, 0, legend["6"].minValue, legend["6"].minSize, legend["6"].maxValue, legend["6"].maxSize],
						8, ["interpolate", ["linear"], ["get", "nb"], 0, 0, legend["8"].minValue, legend["8"].minSize, legend["8"].maxValue, legend["8"].maxSize],
						0
					]
				}
			});
		}

		style.sources = Object.assign(style.sources, sources);
		style.layers = style.layers.concat(layers);

		return { legend, style };
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

// List of OSM tags -> URL mappings
exports.getOsmToUrlMappings = () => {
	const res = {};

	tag2link.filter(t => t.rank !== "deprecated").forEach(t => {
		const osmKey = t.key.substring(4);
		if(Array.isArray(res[osmKey])) {
			res[osmKey].push(t.url);
		}
		else if(typeof res[osmKey] === "string") {
			const oldStr = res[osmKey];
			res[osmKey] = [ oldStr, t.url ];
		}
		else {
			res[osmKey] = t.url;
		}
	});

	return res;
};

// List of dates since project start until today
exports.getProjectDays = (project) => {
	const days = [];
	const start = new Date(project.start_date);
	let end = new Date(project.end_date);
	if(end > new Date()) { end = new Date(); }
	for(var arr=[],dt=new Date(start); dt<=end; dt.setDate(dt.getDate()+1)){
		days.push(new Date(dt).toISOString().split("T")[0]);
	}
	return days;
};
