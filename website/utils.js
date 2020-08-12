const CONFIG = require('../config.json');

// Get current+past projects
exports.filterProjects = (projects) => {
	const prjs = { past: [], current: null };
	Object.values(projects).forEach(project => {
		// Check dates
		if(new Date(project.start_date).getTime() <= Date.now() && Date.now() <= new Date(project.end_date).getTime()) {
			prjs.current = project;
		}
		else if(new Date(project.end_date).getTime() < Date.now()) {
			prjs.past.push({
				id: project.id,
				icon: `/images/badges/${project.id.split("_").pop()}.svg`,
				title: project.title,
				period: new Date(project.start_date).toLocaleDateString('fr-FR', { year: 'numeric', month: 'numeric' })
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

		// Osmose
		p.datasources
		.filter(ds => ds.source === "osmose")
		.forEach(ds => {
			const id = `osmose_${ds.item}_${ds.class || "all"}`;
			const params = { item: ds.item, class: ds.class, country: ds.country };
			const color = ds.color || "#b71c1c";

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
			const color = ds.color || "#01579B";
			sources[id] = { type: "geojson", data: { type: "FeatureCollection", features: [] } };

			layers.push({
				id: id,
				source: `notes_${dsid}`,
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
