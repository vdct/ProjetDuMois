const CONFIG = require('../config.json');
const fetch = require('node-fetch');
const tag2link = require('tag2link');

function getFallbackStyle() {
	return {
		version: 8,
		name: "Projet du mois.fr fallback style",
		sources: {
			osm: {
				type: "raster",
				tiles: [ "https://tile.openstreetmap.org/{z}/{x}/{y}.png" ],
				maxzoom: 19,
				tileSize: 256,
				attribution: "<a href='https://www.openstreetmap.org/copyright'>&copy; OpenStreetMap</a>"
			}
		},
		layers: [{
			id: "osm_base",
			source: "osm",
			type: "raster"
		}]
	};
}

function flatten(array) {
	if(array.length == 0)
		return array;
	else if(Array.isArray(array[0]))
		return flatten(array[0]).concat(flatten(array.slice(1)));
	else
		return [array[0]].concat(flatten(array.slice(1)));
}

let filterDatasource = (obj = {}) => {
	const authorized = ["minzoom", "maxzoom", "tiles", "tileSize", "layers", "data"];
	const out = {};

	Object.entries(obj).forEach(e => {
		if(authorized.includes(e[0]) && e[1] !== undefined && e[1] !== null) {
			out[e[0]] = e[1];
		}
	});

	return out;
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
	return fetch(CONFIG.VECT_STYLE)
	.then(res => res.ok ? res.json() : getFallbackStyle())
	.then(style => {
		const legend = [];
		let vectorMinZoom;
		let sources = {};
		let layers = [];
		const updateVectorMinZoom = val => { vectorMinZoom = !isNaN(parseFloat(val)) ? Math.min(vectorMinZoom === undefined ? 50 : vectorMinZoom, parseFloat(val)) : vectorMinZoom; }

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

			// Source backgrounds
			p.datasources
			.filter(ds => "background" === ds.source)
			.forEach((ds, dsid) => {
				const id = `${ds.source}_${dsid}`;

				sources[id] = Object.assign({}, filterDatasource(ds));

				if(ds.tiles === "mapillary") {
					sources[id].tiles = [ "https://tiles.mapillary.com/maps/vtp/mly1_computed_public/2/{z}/{x}/{y}?access_token="+CONFIG.MAPILLARY_API_KEY ];
					sources[id].type = "vector";
					sources[id].minzoom = 14;
					sources[id].maxzoom = 14;
					sources[id].tileSize = 512;

					layers.push({
						id: id,
						type: "circle",
						source: id,
						"source-layer": "image",
						paint: {
							"circle-color": "rgb(53, 175, 109)",
							"circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 2, 16, 6],
							"circle-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, ["case", ["all",
								[">=", ["get","captured_at"], Date.now()-3*365*24*60*60*1000],
								[">=", ["get", "quality_score"], 3]],
							1, 0]]
						},
						layout: { visibility: "none" }
					});

					legend.push({ media: "raster", color: "rgb(53, 175, 109)", label: ds.name, layerId: id, icon: ds.icon });
				}
				else {
					sources[id].type = "raster";

					// Default minzoom values if not specified
					if (!sources[id].minzoom) {
						sources[id].minzoom = 2
					}

					// Default maxzoom values if not specified
					if (!sources[id].maxzoom) {
						sources[id].maxzoom = 19
					}

					// Default tileSize values if not specified
					if (!sources[id].tileSize) {
						sources[id].tileSize = 256
					}

					layers.push({
						id: id,
						source: id,
						type: "raster",
						layout: { visibility: "none" }
					});

					legend.push({ media: "raster", color:null, label: ds.name, layerId: id, icon: ds.icon });
				}
			});

			// Source osm-extra
			p.datasources
			.filter(ds => "osm-extra" === ds.source)
			.forEach((ds, dsid) => {
				const id = `${ds.source}_${dsid}`;
				const color = ds.color || "gray";
				const layer = ds.layer || `public.pdm_project_${p.id.split("_").pop()}`;

				sources[id] = Object.assign({
					tiles: [ `${CONFIG.PDM_TILES_URL}/${layer}/{z}/{x}/{y}.mvt` ],
					layers: [ layer ],
					minzoom: 9,
					maxzoom: 14
				}, filterDatasource(ds));
				sources[id].type = "vector";
				updateVectorMinZoom(sources[id].minzoom);

				layers.push({
					id: id,
					source: id,
					type: "circle",
					"source-layer": sources[id].layers[0],
					paint: {
						"circle-color": color,
						"circle-opacity": [ "interpolate", ["linear"], ["zoom"], 9, 0, 10, 1 ],
						"circle-radius": [ "interpolate", ["linear"], ["zoom"], 9, 2, 11, 3, 13, 5, 19, 12 ]
					}
				});

				legend.push({ media: "vector", color, label: ds.name, layerId: id });
			});

			// Source OSM Compare
			p.datasources
			.filter(ds => "osm-compare" === ds.source)
			.forEach((ds, dsid) => {
				const id = `${ds.source}_${dsid}`;
				const color = ds.color || "#FF7043"; // Orange
				const layer = `public.pdm_project_${p.id.split("_").pop()}_compare_tiles_filtered`;

				sources[id] = Object.assign({
					tiles: [ `${CONFIG.PDM_TILES_URL}/${layer}/{z}/{x}/{y}.mvt` ],
					layers: [ layer ],
					minzoom: 9,
					maxzoom: 14
				}, filterDatasource(ds));
				sources[id].type = "vector";
				updateVectorMinZoom(sources[id].minzoom);

				layers.push({
					id: id,
					source: id,
					type: "circle",
					"source-layer": sources[id].layers[0],
					paint: {
						"circle-color": color,
						"circle-opacity": [ "interpolate", ["linear"], ["zoom"], 9, 0, 10, 1 ],
						"circle-radius": [ "interpolate", ["linear"], ["zoom"], 9, 2, 11, 3, 13, 5, 19, 12 ]
					}
				});

				legend.push({ media: "vector", color, label: ds.name, layerId: id });
			});

			// Source osm
			p.datasources
			.filter(ds => "osm" === ds.source)
			.forEach((ds, dsid) => {
				const id = `${ds.source}_${dsid}`;
				const color = ds.color || "#2E7D32"; // Green
				const layer = `public.pdm_project_${p.id.split("_").pop()}`;

				sources[id] = Object.assign({
					tiles: [ `${CONFIG.PDM_TILES_URL}/${layer}/{z}/{x}/{y}.mvt` ],
					layers: [ layer ],
					minzoom: 7,
					maxzoom: 14
				}, filterDatasource(ds));
				sources[id].type = "vector";
				updateVectorMinZoom(sources[id].minzoom);

				layers.push({
					id: id,
					source: id,
					type: "circle",
					"source-layer": sources[id].layers[0],
					paint: Object.assign({ "circle-stroke-color": color }, circlePaint)
				});

				legend.push({ media: "vector", color, label: ds.name, layerId: id });
			});

			// Source osmose
			p.datasources
			.filter(ds => ds.source === "osmose")
			.forEach(ds => {
				const id = `${ds.source}_${ds.item}_${ds.class || "all"}`;
				const params = { item: ds.item, class: ds.class, country: ds.country };
				const color = ds.color || "#b71c1c"; // Red

				sources[id] = Object.assign({
					tiles: [ `${CONFIG.OSMOSE_URL}/api/0.3/issues/{z}/{x}/{y}.mvt?${exports.queryParams(params)}` ],
					layers: [ "issues" ],
					minzoom: 7,
					maxzoom: 18
				}, filterDatasource(ds));
				sources[id].type = "vector";
				updateVectorMinZoom(sources[id].minzoom);

				layers.push({
					id: id,
					source: id,
					type: "circle",
					"source-layer": sources[id].layers[0],
					paint: Object.assign({ "circle-stroke-color": color }, circlePaint)
				});

				legend.push({ media: "vector", color, label: ds.name, layerId: id });
			});

			// Source notes
			p.datasources
			.filter(ds => ds.source === "notes")
			.forEach((ds, dsid) => {
				const id = `${ds.source}_${dsid}`;
				const color = ds.color || "#01579B"; // Blue
				sources[id] = Object.assign({
					data: { type: "FeatureCollection", features: [] }
				}, filterDatasource(ds));
				sources[id].type = "geojson";

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
			minZoom: vectorMinZoom === undefined ? 7 : vectorMinZoom,
			legend: legend.reverse(),
			pdmSources: Object.keys(sources)
		};
	});
};

// Map style JSON for statistics
exports.getMapStatsStyle = (p, maxPerLevel) => {
	return fetch(CONFIG.VECT_STYLE)
	.then(res => res.ok ? res.json() : getFallbackStyle())
	.then(style => {
		let sources = {};
		let layers = [];
		const legend = {
			"4": { color: "#2196F3", minSize: 3, minValue: 1, maxSize: 30, maxValue: maxPerLevel["4"] },
			"6": { color: "#4A148C", minSize: 3, minValue: 1, maxSize: 35, maxValue: maxPerLevel["6"] },
			"8": { color: "#004D40", minSize: 3, minValue: 1, maxSize: 40, maxValue: maxPerLevel["8"] }
		};

		if(p && p.statistics && p.statistics.count) {
			const condOpacity = ["interpolate", ["linear"], ["zoom"],
				4.9, ["case", ["==", ["get", "admin_level"], 4], 1, 0 ],
				5, 0,
				5.1, ["case", ["==", ["get", "admin_level"], 6], 1, 0 ],
				7.9, ["case", ["==", ["get", "admin_level"], 6], 1, 0 ],
				8, 0,
				8.1, ["case", ["==", ["get", "admin_level"], 8], 1, 0 ]
			];

			// Source stats
			p.datasources
			.filter(ds => "stats" === ds.source)
			.forEach((ds, dsid) => {
				const id = `${ds.source}_${dsid}`;
				let layer = ds.layer ? ds.layer : "public.pdm_boundary_project_tiles";

				sources[id] = Object.assign({
					tiles: [ `${CONFIG.PDM_TILES_URL}/${layer}/{z}/{x}/{y}.mvt?project_id=${p.id}` ],
					layers: [ layer ],
					minzoom: 2,
					maxzoom: 14
				}, filterDatasource(ds));
				sources[id].type = "vector";

				layers.push({
					id: id,
					source: id,
					type: "circle",
					"source-layer": sources[id].layers[0],
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
	const res = { "website": "$1", "contact:website": "$1" };
	const hasPreferred = tag2link.filter(t => t.rank === "preferred").map(t => t.key.substring(4));
	hasPreferred.push("website");
	hasPreferred.push("contact:website");

	tag2link
	.filter(t => t.rank !== "deprecated")
	.forEach(t => {
		const osmKey = t.key.substring(4);
		if(hasPreferred.includes(osmKey)) {
			if(t.rank === "preferred") {
				res[osmKey] = t.url;
			}
		}
		else if(Array.isArray(res[osmKey])) {
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
	let end = new Date();
	const summarize = end.getTime() - start.getTime() > 1000*60*60*24*60;

	for(let dt = new Date(start); dt.getTime() <= end.getTime(); dt.setTime(dt.getTime() + 1000*60*60*24)) {
		if(!summarize || end.getTime() - dt.getTime() < 1000*60*60*24 || new Date(dt).toISOString().split("T")[0].substring(8,10) === "01") {
			days.push(new Date(dt).toISOString().split("T")[0]);
		}
	}

	return days;
};
