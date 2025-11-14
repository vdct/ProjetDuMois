(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.turf = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";Object.defineProperty(exports, "__esModule", {value: true});// index.ts
var _meta = require('@turf/meta');
function bbox(geojson, options = {}) {
  if (geojson.bbox != null && true !== options.recompute) {
    return geojson.bbox;
  }
  const result = [Infinity, Infinity, -Infinity, -Infinity];
  _meta.coordEach.call(void 0, geojson, (coord) => {
    if (result[0] > coord[0]) {
      result[0] = coord[0];
    }
    if (result[1] > coord[1]) {
      result[1] = coord[1];
    }
    if (result[2] < coord[0]) {
      result[2] = coord[0];
    }
    if (result[3] < coord[1]) {
      result[3] = coord[1];
    }
  });
  return result;
}
var turf_bbox_default = bbox;



exports.bbox = bbox; exports.default = turf_bbox_default;

},{"@turf/meta":7}],2:[function(require,module,exports){
"use strict";Object.defineProperty(exports, "__esModule", {value: true});// index.ts
var _bbox = require('@turf/bbox');
var _booleanpointinpolygon = require('@turf/boolean-point-in-polygon');
var _booleanpointonline = require('@turf/boolean-point-on-line');
var _invariant = require('@turf/invariant');
function booleanContains(feature1, feature2) {
  const geom1 = _invariant.getGeom.call(void 0, feature1);
  const geom2 = _invariant.getGeom.call(void 0, feature2);
  const type1 = geom1.type;
  const type2 = geom2.type;
  const coords1 = geom1.coordinates;
  const coords2 = geom2.coordinates;
  switch (type1) {
    case "Point":
      switch (type2) {
        case "Point":
          return compareCoords(coords1, coords2);
        default:
          throw new Error("feature2 " + type2 + " geometry not supported");
      }
    case "MultiPoint":
      switch (type2) {
        case "Point":
          return isPointInMultiPoint(geom1, geom2);
        case "MultiPoint":
          return isMultiPointInMultiPoint(geom1, geom2);
        default:
          throw new Error("feature2 " + type2 + " geometry not supported");
      }
    case "LineString":
      switch (type2) {
        case "Point":
          return _booleanpointonline.booleanPointOnLine.call(void 0, geom2, geom1, { ignoreEndVertices: true });
        case "LineString":
          return isLineOnLine(geom1, geom2);
        case "MultiPoint":
          return isMultiPointOnLine(geom1, geom2);
        default:
          throw new Error("feature2 " + type2 + " geometry not supported");
      }
    case "Polygon":
      switch (type2) {
        case "Point":
          return _booleanpointinpolygon.booleanPointInPolygon.call(void 0, geom2, geom1, { ignoreBoundary: true });
        case "LineString":
          return isLineInPoly(geom1, geom2);
        case "Polygon":
          return isPolyInPoly(geom1, geom2);
        case "MultiPoint":
          return isMultiPointInPoly(geom1, geom2);
        default:
          throw new Error("feature2 " + type2 + " geometry not supported");
      }
    case "MultiPolygon":
      switch (type2) {
        case "Polygon":
          return isPolygonInMultiPolygon(geom1, geom2);
        default:
          throw new Error("feature2 " + type2 + " geometry not supported");
      }
    default:
      throw new Error("feature1 " + type1 + " geometry not supported");
  }
}
function isPolygonInMultiPolygon(multiPolygon, polygon) {
  return multiPolygon.coordinates.some(
    (coords) => isPolyInPoly({ type: "Polygon", coordinates: coords }, polygon)
  );
}
function isPointInMultiPoint(multiPoint, pt) {
  let i;
  let output = false;
  for (i = 0; i < multiPoint.coordinates.length; i++) {
    if (compareCoords(multiPoint.coordinates[i], pt.coordinates)) {
      output = true;
      break;
    }
  }
  return output;
}
function isMultiPointInMultiPoint(multiPoint1, multiPoint2) {
  for (const coord2 of multiPoint2.coordinates) {
    let matchFound = false;
    for (const coord1 of multiPoint1.coordinates) {
      if (compareCoords(coord2, coord1)) {
        matchFound = true;
        break;
      }
    }
    if (!matchFound) {
      return false;
    }
  }
  return true;
}
function isMultiPointOnLine(lineString, multiPoint) {
  let haveFoundInteriorPoint = false;
  for (const coord of multiPoint.coordinates) {
    if (_booleanpointonline.booleanPointOnLine.call(void 0, coord, lineString, { ignoreEndVertices: true })) {
      haveFoundInteriorPoint = true;
    }
    if (!_booleanpointonline.booleanPointOnLine.call(void 0, coord, lineString)) {
      return false;
    }
  }
  if (haveFoundInteriorPoint) {
    return true;
  }
  return false;
}
function isMultiPointInPoly(polygon, multiPoint) {
  for (const coord of multiPoint.coordinates) {
    if (!_booleanpointinpolygon.booleanPointInPolygon.call(void 0, coord, polygon, { ignoreBoundary: true })) {
      return false;
    }
  }
  return true;
}
function isLineOnLine(lineString1, lineString2) {
  let haveFoundInteriorPoint = false;
  for (const coords of lineString2.coordinates) {
    if (_booleanpointonline.booleanPointOnLine.call(void 0, { type: "Point", coordinates: coords }, lineString1, {
      ignoreEndVertices: true
    })) {
      haveFoundInteriorPoint = true;
    }
    if (!_booleanpointonline.booleanPointOnLine.call(void 0, { type: "Point", coordinates: coords }, lineString1, {
      ignoreEndVertices: false
    })) {
      return false;
    }
  }
  return haveFoundInteriorPoint;
}
function isLineInPoly(polygon, linestring) {
  let output = false;
  let i = 0;
  const polyBbox = _bbox.bbox.call(void 0, polygon);
  const lineBbox = _bbox.bbox.call(void 0, linestring);
  if (!doBBoxOverlap(polyBbox, lineBbox)) {
    return false;
  }
  for (i; i < linestring.coordinates.length - 1; i++) {
    const midPoint = getMidpoint(
      linestring.coordinates[i],
      linestring.coordinates[i + 1]
    );
    if (_booleanpointinpolygon.booleanPointInPolygon.call(void 0, { type: "Point", coordinates: midPoint }, polygon, {
      ignoreBoundary: true
    })) {
      output = true;
      break;
    }
  }
  return output;
}
function isPolyInPoly(feature1, feature2) {
  if (feature1.type === "Feature" && feature1.geometry === null) {
    return false;
  }
  if (feature2.type === "Feature" && feature2.geometry === null) {
    return false;
  }
  const poly1Bbox = _bbox.bbox.call(void 0, feature1);
  const poly2Bbox = _bbox.bbox.call(void 0, feature2);
  if (!doBBoxOverlap(poly1Bbox, poly2Bbox)) {
    return false;
  }
  const coords = _invariant.getGeom.call(void 0, feature2).coordinates;
  for (const ring of coords) {
    for (const coord of ring) {
      if (!_booleanpointinpolygon.booleanPointInPolygon.call(void 0, coord, feature1)) {
        return false;
      }
    }
  }
  return true;
}
function doBBoxOverlap(bbox1, bbox2) {
  if (bbox1[0] > bbox2[0]) {
    return false;
  }
  if (bbox1[2] < bbox2[2]) {
    return false;
  }
  if (bbox1[1] > bbox2[1]) {
    return false;
  }
  if (bbox1[3] < bbox2[3]) {
    return false;
  }
  return true;
}
function compareCoords(pair1, pair2) {
  return pair1[0] === pair2[0] && pair1[1] === pair2[1];
}
function getMidpoint(pair1, pair2) {
  return [(pair1[0] + pair2[0]) / 2, (pair1[1] + pair2[1]) / 2];
}
var turf_boolean_contains_default = booleanContains;














exports.booleanContains = booleanContains; exports.compareCoords = compareCoords; exports.default = turf_boolean_contains_default; exports.doBBoxOverlap = doBBoxOverlap; exports.getMidpoint = getMidpoint; exports.isLineInPoly = isLineInPoly; exports.isLineOnLine = isLineOnLine; exports.isMultiPointInMultiPoint = isMultiPointInMultiPoint; exports.isMultiPointInPoly = isMultiPointInPoly; exports.isMultiPointOnLine = isMultiPointOnLine; exports.isPointInMultiPoint = isPointInMultiPoint; exports.isPolyInPoly = isPolyInPoly; exports.isPolygonInMultiPolygon = isPolygonInMultiPolygon;

},{"@turf/bbox":1,"@turf/boolean-point-in-polygon":3,"@turf/boolean-point-on-line":4,"@turf/invariant":6}],3:[function(require,module,exports){
"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }// index.ts
var _pointinpolygonhao = require('point-in-polygon-hao'); var _pointinpolygonhao2 = _interopRequireDefault(_pointinpolygonhao);
var _invariant = require('@turf/invariant');
function booleanPointInPolygon(point, polygon, options = {}) {
  if (!point) {
    throw new Error("point is required");
  }
  if (!polygon) {
    throw new Error("polygon is required");
  }
  const pt = _invariant.getCoord.call(void 0, point);
  const geom = _invariant.getGeom.call(void 0, polygon);
  const type = geom.type;
  const bbox = polygon.bbox;
  let polys = geom.coordinates;
  if (bbox && inBBox(pt, bbox) === false) {
    return false;
  }
  if (type === "Polygon") {
    polys = [polys];
  }
  let result = false;
  for (var i = 0; i < polys.length; ++i) {
    const polyResult = _pointinpolygonhao2.default.call(void 0, pt, polys[i]);
    if (polyResult === 0) return options.ignoreBoundary ? false : true;
    else if (polyResult) result = true;
  }
  return result;
}
function inBBox(pt, bbox) {
  return bbox[0] <= pt[0] && bbox[1] <= pt[1] && bbox[2] >= pt[0] && bbox[3] >= pt[1];
}
var turf_boolean_point_in_polygon_default = booleanPointInPolygon;



exports.booleanPointInPolygon = booleanPointInPolygon; exports.default = turf_boolean_point_in_polygon_default;

},{"@turf/invariant":6,"point-in-polygon-hao":8}],4:[function(require,module,exports){
"use strict";Object.defineProperty(exports, "__esModule", {value: true});// index.ts
var _invariant = require('@turf/invariant');
function booleanPointOnLine(pt, line, options = {}) {
  const ptCoords = _invariant.getCoord.call(void 0, pt);
  const lineCoords = _invariant.getCoords.call(void 0, line);
  for (let i = 0; i < lineCoords.length - 1; i++) {
    let ignoreBoundary = false;
    if (options.ignoreEndVertices) {
      if (i === 0) {
        ignoreBoundary = "start";
      }
      if (i === lineCoords.length - 2) {
        ignoreBoundary = "end";
      }
      if (i === 0 && i + 1 === lineCoords.length - 1) {
        ignoreBoundary = "both";
      }
    }
    if (isPointOnLineSegment(
      lineCoords[i],
      lineCoords[i + 1],
      ptCoords,
      ignoreBoundary,
      typeof options.epsilon === "undefined" ? null : options.epsilon
    )) {
      return true;
    }
  }
  return false;
}
function isPointOnLineSegment(lineSegmentStart, lineSegmentEnd, pt, excludeBoundary, epsilon) {
  const x = pt[0];
  const y = pt[1];
  const x1 = lineSegmentStart[0];
  const y1 = lineSegmentStart[1];
  const x2 = lineSegmentEnd[0];
  const y2 = lineSegmentEnd[1];
  const dxc = pt[0] - x1;
  const dyc = pt[1] - y1;
  const dxl = x2 - x1;
  const dyl = y2 - y1;
  const cross = dxc * dyl - dyc * dxl;
  if (epsilon !== null) {
    if (Math.abs(cross) > epsilon) {
      return false;
    }
  } else if (cross !== 0) {
    return false;
  }
  if (Math.abs(dxl) === Math.abs(dyl) && Math.abs(dxl) === 0) {
    if (excludeBoundary) {
      return false;
    }
    if (pt[0] === lineSegmentStart[0] && pt[1] === lineSegmentStart[1]) {
      return true;
    } else {
      return false;
    }
  }
  if (!excludeBoundary) {
    if (Math.abs(dxl) >= Math.abs(dyl)) {
      return dxl > 0 ? x1 <= x && x <= x2 : x2 <= x && x <= x1;
    }
    return dyl > 0 ? y1 <= y && y <= y2 : y2 <= y && y <= y1;
  } else if (excludeBoundary === "start") {
    if (Math.abs(dxl) >= Math.abs(dyl)) {
      return dxl > 0 ? x1 < x && x <= x2 : x2 <= x && x < x1;
    }
    return dyl > 0 ? y1 < y && y <= y2 : y2 <= y && y < y1;
  } else if (excludeBoundary === "end") {
    if (Math.abs(dxl) >= Math.abs(dyl)) {
      return dxl > 0 ? x1 <= x && x < x2 : x2 < x && x <= x1;
    }
    return dyl > 0 ? y1 <= y && y < y2 : y2 < y && y <= y1;
  } else if (excludeBoundary === "both") {
    if (Math.abs(dxl) >= Math.abs(dyl)) {
      return dxl > 0 ? x1 < x && x < x2 : x2 < x && x < x1;
    }
    return dyl > 0 ? y1 < y && y < y2 : y2 < y && y < y1;
  }
  return false;
}
var turf_boolean_point_on_line_default = booleanPointOnLine;



exports.booleanPointOnLine = booleanPointOnLine; exports.default = turf_boolean_point_on_line_default;

},{"@turf/invariant":6}],5:[function(require,module,exports){
"use strict";Object.defineProperty(exports, "__esModule", {value: true});// index.ts
var earthRadius = 63710088e-1;
var factors = {
  centimeters: earthRadius * 100,
  centimetres: earthRadius * 100,
  degrees: 360 / (2 * Math.PI),
  feet: earthRadius * 3.28084,
  inches: earthRadius * 39.37,
  kilometers: earthRadius / 1e3,
  kilometres: earthRadius / 1e3,
  meters: earthRadius,
  metres: earthRadius,
  miles: earthRadius / 1609.344,
  millimeters: earthRadius * 1e3,
  millimetres: earthRadius * 1e3,
  nauticalmiles: earthRadius / 1852,
  radians: 1,
  yards: earthRadius * 1.0936
};
var areaFactors = {
  acres: 247105e-9,
  centimeters: 1e4,
  centimetres: 1e4,
  feet: 10.763910417,
  hectares: 1e-4,
  inches: 1550.003100006,
  kilometers: 1e-6,
  kilometres: 1e-6,
  meters: 1,
  metres: 1,
  miles: 386e-9,
  nauticalmiles: 29155334959812285e-23,
  millimeters: 1e6,
  millimetres: 1e6,
  yards: 1.195990046
};
function feature(geom, properties, options = {}) {
  const feat = { type: "Feature" };
  if (options.id === 0 || options.id) {
    feat.id = options.id;
  }
  if (options.bbox) {
    feat.bbox = options.bbox;
  }
  feat.properties = properties || {};
  feat.geometry = geom;
  return feat;
}
function geometry(type, coordinates, _options = {}) {
  switch (type) {
    case "Point":
      return point(coordinates).geometry;
    case "LineString":
      return lineString(coordinates).geometry;
    case "Polygon":
      return polygon(coordinates).geometry;
    case "MultiPoint":
      return multiPoint(coordinates).geometry;
    case "MultiLineString":
      return multiLineString(coordinates).geometry;
    case "MultiPolygon":
      return multiPolygon(coordinates).geometry;
    default:
      throw new Error(type + " is invalid");
  }
}
function point(coordinates, properties, options = {}) {
  if (!coordinates) {
    throw new Error("coordinates is required");
  }
  if (!Array.isArray(coordinates)) {
    throw new Error("coordinates must be an Array");
  }
  if (coordinates.length < 2) {
    throw new Error("coordinates must be at least 2 numbers long");
  }
  if (!isNumber(coordinates[0]) || !isNumber(coordinates[1])) {
    throw new Error("coordinates must contain numbers");
  }
  const geom = {
    type: "Point",
    coordinates
  };
  return feature(geom, properties, options);
}
function points(coordinates, properties, options = {}) {
  return featureCollection(
    coordinates.map((coords) => {
      return point(coords, properties);
    }),
    options
  );
}
function polygon(coordinates, properties, options = {}) {
  for (const ring of coordinates) {
    if (ring.length < 4) {
      throw new Error(
        "Each LinearRing of a Polygon must have 4 or more Positions."
      );
    }
    if (ring[ring.length - 1].length !== ring[0].length) {
      throw new Error("First and last Position are not equivalent.");
    }
    for (let j = 0; j < ring[ring.length - 1].length; j++) {
      if (ring[ring.length - 1][j] !== ring[0][j]) {
        throw new Error("First and last Position are not equivalent.");
      }
    }
  }
  const geom = {
    type: "Polygon",
    coordinates
  };
  return feature(geom, properties, options);
}
function polygons(coordinates, properties, options = {}) {
  return featureCollection(
    coordinates.map((coords) => {
      return polygon(coords, properties);
    }),
    options
  );
}
function lineString(coordinates, properties, options = {}) {
  if (coordinates.length < 2) {
    throw new Error("coordinates must be an array of two or more positions");
  }
  const geom = {
    type: "LineString",
    coordinates
  };
  return feature(geom, properties, options);
}
function lineStrings(coordinates, properties, options = {}) {
  return featureCollection(
    coordinates.map((coords) => {
      return lineString(coords, properties);
    }),
    options
  );
}
function featureCollection(features, options = {}) {
  const fc = { type: "FeatureCollection" };
  if (options.id) {
    fc.id = options.id;
  }
  if (options.bbox) {
    fc.bbox = options.bbox;
  }
  fc.features = features;
  return fc;
}
function multiLineString(coordinates, properties, options = {}) {
  const geom = {
    type: "MultiLineString",
    coordinates
  };
  return feature(geom, properties, options);
}
function multiPoint(coordinates, properties, options = {}) {
  const geom = {
    type: "MultiPoint",
    coordinates
  };
  return feature(geom, properties, options);
}
function multiPolygon(coordinates, properties, options = {}) {
  const geom = {
    type: "MultiPolygon",
    coordinates
  };
  return feature(geom, properties, options);
}
function geometryCollection(geometries, properties, options = {}) {
  const geom = {
    type: "GeometryCollection",
    geometries
  };
  return feature(geom, properties, options);
}
function round(num, precision = 0) {
  if (precision && !(precision >= 0)) {
    throw new Error("precision must be a positive number");
  }
  const multiplier = Math.pow(10, precision || 0);
  return Math.round(num * multiplier) / multiplier;
}
function radiansToLength(radians, units = "kilometers") {
  const factor = factors[units];
  if (!factor) {
    throw new Error(units + " units is invalid");
  }
  return radians * factor;
}
function lengthToRadians(distance, units = "kilometers") {
  const factor = factors[units];
  if (!factor) {
    throw new Error(units + " units is invalid");
  }
  return distance / factor;
}
function lengthToDegrees(distance, units) {
  return radiansToDegrees(lengthToRadians(distance, units));
}
function bearingToAzimuth(bearing) {
  let angle = bearing % 360;
  if (angle < 0) {
    angle += 360;
  }
  return angle;
}
function azimuthToBearing(angle) {
  angle = angle % 360;
  if (angle > 180) {
    return angle - 360;
  } else if (angle < -180) {
    return angle + 360;
  }
  return angle;
}
function radiansToDegrees(radians) {
  const normalisedRadians = radians % (2 * Math.PI);
  return normalisedRadians * 180 / Math.PI;
}
function degreesToRadians(degrees) {
  const normalisedDegrees = degrees % 360;
  return normalisedDegrees * Math.PI / 180;
}
function convertLength(length, originalUnit = "kilometers", finalUnit = "kilometers") {
  if (!(length >= 0)) {
    throw new Error("length must be a positive number");
  }
  return radiansToLength(lengthToRadians(length, originalUnit), finalUnit);
}
function convertArea(area, originalUnit = "meters", finalUnit = "kilometers") {
  if (!(area >= 0)) {
    throw new Error("area must be a positive number");
  }
  const startFactor = areaFactors[originalUnit];
  if (!startFactor) {
    throw new Error("invalid original units");
  }
  const finalFactor = areaFactors[finalUnit];
  if (!finalFactor) {
    throw new Error("invalid final units");
  }
  return area / startFactor * finalFactor;
}
function isNumber(num) {
  return !isNaN(num) && num !== null && !Array.isArray(num);
}
function isObject(input) {
  return input !== null && typeof input === "object" && !Array.isArray(input);
}
function validateBBox(bbox) {
  if (!bbox) {
    throw new Error("bbox is required");
  }
  if (!Array.isArray(bbox)) {
    throw new Error("bbox must be an Array");
  }
  if (bbox.length !== 4 && bbox.length !== 6) {
    throw new Error("bbox must be an Array of 4 or 6 numbers");
  }
  bbox.forEach((num) => {
    if (!isNumber(num)) {
      throw new Error("bbox must only contain numbers");
    }
  });
}
function validateId(id) {
  if (!id) {
    throw new Error("id is required");
  }
  if (["string", "number"].indexOf(typeof id) === -1) {
    throw new Error("id must be a number or a string");
  }
}































exports.areaFactors = areaFactors; exports.azimuthToBearing = azimuthToBearing; exports.bearingToAzimuth = bearingToAzimuth; exports.convertArea = convertArea; exports.convertLength = convertLength; exports.degreesToRadians = degreesToRadians; exports.earthRadius = earthRadius; exports.factors = factors; exports.feature = feature; exports.featureCollection = featureCollection; exports.geometry = geometry; exports.geometryCollection = geometryCollection; exports.isNumber = isNumber; exports.isObject = isObject; exports.lengthToDegrees = lengthToDegrees; exports.lengthToRadians = lengthToRadians; exports.lineString = lineString; exports.lineStrings = lineStrings; exports.multiLineString = multiLineString; exports.multiPoint = multiPoint; exports.multiPolygon = multiPolygon; exports.point = point; exports.points = points; exports.polygon = polygon; exports.polygons = polygons; exports.radiansToDegrees = radiansToDegrees; exports.radiansToLength = radiansToLength; exports.round = round; exports.validateBBox = validateBBox; exports.validateId = validateId;

},{}],6:[function(require,module,exports){
"use strict";Object.defineProperty(exports, "__esModule", {value: true});// index.ts
var _helpers = require('@turf/helpers');
function getCoord(coord) {
  if (!coord) {
    throw new Error("coord is required");
  }
  if (!Array.isArray(coord)) {
    if (coord.type === "Feature" && coord.geometry !== null && coord.geometry.type === "Point") {
      return [...coord.geometry.coordinates];
    }
    if (coord.type === "Point") {
      return [...coord.coordinates];
    }
  }
  if (Array.isArray(coord) && coord.length >= 2 && !Array.isArray(coord[0]) && !Array.isArray(coord[1])) {
    return [...coord];
  }
  throw new Error("coord must be GeoJSON Point or an Array of numbers");
}
function getCoords(coords) {
  if (Array.isArray(coords)) {
    return coords;
  }
  if (coords.type === "Feature") {
    if (coords.geometry !== null) {
      return coords.geometry.coordinates;
    }
  } else {
    if (coords.coordinates) {
      return coords.coordinates;
    }
  }
  throw new Error(
    "coords must be GeoJSON Feature, Geometry Object or an Array"
  );
}
function containsNumber(coordinates) {
  if (coordinates.length > 1 && _helpers.isNumber.call(void 0, coordinates[0]) && _helpers.isNumber.call(void 0, coordinates[1])) {
    return true;
  }
  if (Array.isArray(coordinates[0]) && coordinates[0].length) {
    return containsNumber(coordinates[0]);
  }
  throw new Error("coordinates must only contain numbers");
}
function geojsonType(value, type, name) {
  if (!type || !name) {
    throw new Error("type and name required");
  }
  if (!value || value.type !== type) {
    throw new Error(
      "Invalid input to " + name + ": must be a " + type + ", given " + value.type
    );
  }
}
function featureOf(feature, type, name) {
  if (!feature) {
    throw new Error("No feature passed");
  }
  if (!name) {
    throw new Error(".featureOf() requires a name");
  }
  if (!feature || feature.type !== "Feature" || !feature.geometry) {
    throw new Error(
      "Invalid input to " + name + ", Feature with geometry required"
    );
  }
  if (!feature.geometry || feature.geometry.type !== type) {
    throw new Error(
      "Invalid input to " + name + ": must be a " + type + ", given " + feature.geometry.type
    );
  }
}
function collectionOf(featureCollection, type, name) {
  if (!featureCollection) {
    throw new Error("No featureCollection passed");
  }
  if (!name) {
    throw new Error(".collectionOf() requires a name");
  }
  if (!featureCollection || featureCollection.type !== "FeatureCollection") {
    throw new Error(
      "Invalid input to " + name + ", FeatureCollection required"
    );
  }
  for (const feature of featureCollection.features) {
    if (!feature || feature.type !== "Feature" || !feature.geometry) {
      throw new Error(
        "Invalid input to " + name + ", Feature with geometry required"
      );
    }
    if (!feature.geometry || feature.geometry.type !== type) {
      throw new Error(
        "Invalid input to " + name + ": must be a " + type + ", given " + feature.geometry.type
      );
    }
  }
}
function getGeom(geojson) {
  if (geojson.type === "Feature") {
    return geojson.geometry;
  }
  return geojson;
}
function getType(geojson, _name) {
  if (geojson.type === "FeatureCollection") {
    return "FeatureCollection";
  }
  if (geojson.type === "GeometryCollection") {
    return "GeometryCollection";
  }
  if (geojson.type === "Feature" && geojson.geometry !== null) {
    return geojson.geometry.type;
  }
  return geojson.type;
}









exports.collectionOf = collectionOf; exports.containsNumber = containsNumber; exports.featureOf = featureOf; exports.geojsonType = geojsonType; exports.getCoord = getCoord; exports.getCoords = getCoords; exports.getGeom = getGeom; exports.getType = getType;

},{"@turf/helpers":5}],7:[function(require,module,exports){
"use strict";Object.defineProperty(exports, "__esModule", {value: true});// index.js
var _helpers = require('@turf/helpers');
function coordEach(geojson, callback, excludeWrapCoord) {
  if (geojson === null) return;
  var j, k, l, geometry, stopG, coords, geometryMaybeCollection, wrapShrink = 0, coordIndex = 0, isGeometryCollection, type = geojson.type, isFeatureCollection = type === "FeatureCollection", isFeature = type === "Feature", stop = isFeatureCollection ? geojson.features.length : 1;
  for (var featureIndex = 0; featureIndex < stop; featureIndex++) {
    geometryMaybeCollection = isFeatureCollection ? geojson.features[featureIndex].geometry : isFeature ? geojson.geometry : geojson;
    isGeometryCollection = geometryMaybeCollection ? geometryMaybeCollection.type === "GeometryCollection" : false;
    stopG = isGeometryCollection ? geometryMaybeCollection.geometries.length : 1;
    for (var geomIndex = 0; geomIndex < stopG; geomIndex++) {
      var multiFeatureIndex = 0;
      var geometryIndex = 0;
      geometry = isGeometryCollection ? geometryMaybeCollection.geometries[geomIndex] : geometryMaybeCollection;
      if (geometry === null) continue;
      coords = geometry.coordinates;
      var geomType = geometry.type;
      wrapShrink = excludeWrapCoord && (geomType === "Polygon" || geomType === "MultiPolygon") ? 1 : 0;
      switch (geomType) {
        case null:
          break;
        case "Point":
          if (callback(
            coords,
            coordIndex,
            featureIndex,
            multiFeatureIndex,
            geometryIndex
          ) === false)
            return false;
          coordIndex++;
          multiFeatureIndex++;
          break;
        case "LineString":
        case "MultiPoint":
          for (j = 0; j < coords.length; j++) {
            if (callback(
              coords[j],
              coordIndex,
              featureIndex,
              multiFeatureIndex,
              geometryIndex
            ) === false)
              return false;
            coordIndex++;
            if (geomType === "MultiPoint") multiFeatureIndex++;
          }
          if (geomType === "LineString") multiFeatureIndex++;
          break;
        case "Polygon":
        case "MultiLineString":
          for (j = 0; j < coords.length; j++) {
            for (k = 0; k < coords[j].length - wrapShrink; k++) {
              if (callback(
                coords[j][k],
                coordIndex,
                featureIndex,
                multiFeatureIndex,
                geometryIndex
              ) === false)
                return false;
              coordIndex++;
            }
            if (geomType === "MultiLineString") multiFeatureIndex++;
            if (geomType === "Polygon") geometryIndex++;
          }
          if (geomType === "Polygon") multiFeatureIndex++;
          break;
        case "MultiPolygon":
          for (j = 0; j < coords.length; j++) {
            geometryIndex = 0;
            for (k = 0; k < coords[j].length; k++) {
              for (l = 0; l < coords[j][k].length - wrapShrink; l++) {
                if (callback(
                  coords[j][k][l],
                  coordIndex,
                  featureIndex,
                  multiFeatureIndex,
                  geometryIndex
                ) === false)
                  return false;
                coordIndex++;
              }
              geometryIndex++;
            }
            multiFeatureIndex++;
          }
          break;
        case "GeometryCollection":
          for (j = 0; j < geometry.geometries.length; j++)
            if (coordEach(geometry.geometries[j], callback, excludeWrapCoord) === false)
              return false;
          break;
        default:
          throw new Error("Unknown Geometry Type");
      }
    }
  }
}
function coordReduce(geojson, callback, initialValue, excludeWrapCoord) {
  var previousValue = initialValue;
  coordEach(
    geojson,
    function(currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) {
      if (coordIndex === 0 && initialValue === void 0)
        previousValue = currentCoord;
      else
        previousValue = callback(
          previousValue,
          currentCoord,
          coordIndex,
          featureIndex,
          multiFeatureIndex,
          geometryIndex
        );
    },
    excludeWrapCoord
  );
  return previousValue;
}
function propEach(geojson, callback) {
  var i;
  switch (geojson.type) {
    case "FeatureCollection":
      for (i = 0; i < geojson.features.length; i++) {
        if (callback(geojson.features[i].properties, i) === false) break;
      }
      break;
    case "Feature":
      callback(geojson.properties, 0);
      break;
  }
}
function propReduce(geojson, callback, initialValue) {
  var previousValue = initialValue;
  propEach(geojson, function(currentProperties, featureIndex) {
    if (featureIndex === 0 && initialValue === void 0)
      previousValue = currentProperties;
    else
      previousValue = callback(previousValue, currentProperties, featureIndex);
  });
  return previousValue;
}
function featureEach(geojson, callback) {
  if (geojson.type === "Feature") {
    callback(geojson, 0);
  } else if (geojson.type === "FeatureCollection") {
    for (var i = 0; i < geojson.features.length; i++) {
      if (callback(geojson.features[i], i) === false) break;
    }
  }
}
function featureReduce(geojson, callback, initialValue) {
  var previousValue = initialValue;
  featureEach(geojson, function(currentFeature, featureIndex) {
    if (featureIndex === 0 && initialValue === void 0)
      previousValue = currentFeature;
    else previousValue = callback(previousValue, currentFeature, featureIndex);
  });
  return previousValue;
}
function coordAll(geojson) {
  var coords = [];
  coordEach(geojson, function(coord) {
    coords.push(coord);
  });
  return coords;
}
function geomEach(geojson, callback) {
  var i, j, g, geometry, stopG, geometryMaybeCollection, isGeometryCollection, featureProperties, featureBBox, featureId, featureIndex = 0, isFeatureCollection = geojson.type === "FeatureCollection", isFeature = geojson.type === "Feature", stop = isFeatureCollection ? geojson.features.length : 1;
  for (i = 0; i < stop; i++) {
    geometryMaybeCollection = isFeatureCollection ? geojson.features[i].geometry : isFeature ? geojson.geometry : geojson;
    featureProperties = isFeatureCollection ? geojson.features[i].properties : isFeature ? geojson.properties : {};
    featureBBox = isFeatureCollection ? geojson.features[i].bbox : isFeature ? geojson.bbox : void 0;
    featureId = isFeatureCollection ? geojson.features[i].id : isFeature ? geojson.id : void 0;
    isGeometryCollection = geometryMaybeCollection ? geometryMaybeCollection.type === "GeometryCollection" : false;
    stopG = isGeometryCollection ? geometryMaybeCollection.geometries.length : 1;
    for (g = 0; g < stopG; g++) {
      geometry = isGeometryCollection ? geometryMaybeCollection.geometries[g] : geometryMaybeCollection;
      if (geometry === null) {
        if (callback(
          null,
          featureIndex,
          featureProperties,
          featureBBox,
          featureId
        ) === false)
          return false;
        continue;
      }
      switch (geometry.type) {
        case "Point":
        case "LineString":
        case "MultiPoint":
        case "Polygon":
        case "MultiLineString":
        case "MultiPolygon": {
          if (callback(
            geometry,
            featureIndex,
            featureProperties,
            featureBBox,
            featureId
          ) === false)
            return false;
          break;
        }
        case "GeometryCollection": {
          for (j = 0; j < geometry.geometries.length; j++) {
            if (callback(
              geometry.geometries[j],
              featureIndex,
              featureProperties,
              featureBBox,
              featureId
            ) === false)
              return false;
          }
          break;
        }
        default:
          throw new Error("Unknown Geometry Type");
      }
    }
    featureIndex++;
  }
}
function geomReduce(geojson, callback, initialValue) {
  var previousValue = initialValue;
  geomEach(
    geojson,
    function(currentGeometry, featureIndex, featureProperties, featureBBox, featureId) {
      if (featureIndex === 0 && initialValue === void 0)
        previousValue = currentGeometry;
      else
        previousValue = callback(
          previousValue,
          currentGeometry,
          featureIndex,
          featureProperties,
          featureBBox,
          featureId
        );
    }
  );
  return previousValue;
}
function flattenEach(geojson, callback) {
  geomEach(geojson, function(geometry, featureIndex, properties, bbox, id) {
    var type = geometry === null ? null : geometry.type;
    switch (type) {
      case null:
      case "Point":
      case "LineString":
      case "Polygon":
        if (callback(
          _helpers.feature.call(void 0, geometry, properties, { bbox, id }),
          featureIndex,
          0
        ) === false)
          return false;
        return;
    }
    var geomType;
    switch (type) {
      case "MultiPoint":
        geomType = "Point";
        break;
      case "MultiLineString":
        geomType = "LineString";
        break;
      case "MultiPolygon":
        geomType = "Polygon";
        break;
    }
    for (var multiFeatureIndex = 0; multiFeatureIndex < geometry.coordinates.length; multiFeatureIndex++) {
      var coordinate = geometry.coordinates[multiFeatureIndex];
      var geom = {
        type: geomType,
        coordinates: coordinate
      };
      if (callback(_helpers.feature.call(void 0, geom, properties), featureIndex, multiFeatureIndex) === false)
        return false;
    }
  });
}
function flattenReduce(geojson, callback, initialValue) {
  var previousValue = initialValue;
  flattenEach(
    geojson,
    function(currentFeature, featureIndex, multiFeatureIndex) {
      if (featureIndex === 0 && multiFeatureIndex === 0 && initialValue === void 0)
        previousValue = currentFeature;
      else
        previousValue = callback(
          previousValue,
          currentFeature,
          featureIndex,
          multiFeatureIndex
        );
    }
  );
  return previousValue;
}
function segmentEach(geojson, callback) {
  flattenEach(geojson, function(feature2, featureIndex, multiFeatureIndex) {
    var segmentIndex = 0;
    if (!feature2.geometry) return;
    var type = feature2.geometry.type;
    if (type === "Point" || type === "MultiPoint") return;
    var previousCoords;
    var previousFeatureIndex = 0;
    var previousMultiIndex = 0;
    var prevGeomIndex = 0;
    if (coordEach(
      feature2,
      function(currentCoord, coordIndex, featureIndexCoord, multiPartIndexCoord, geometryIndex) {
        if (previousCoords === void 0 || featureIndex > previousFeatureIndex || multiPartIndexCoord > previousMultiIndex || geometryIndex > prevGeomIndex) {
          previousCoords = currentCoord;
          previousFeatureIndex = featureIndex;
          previousMultiIndex = multiPartIndexCoord;
          prevGeomIndex = geometryIndex;
          segmentIndex = 0;
          return;
        }
        var currentSegment = _helpers.lineString.call(void 0, 
          [previousCoords, currentCoord],
          feature2.properties
        );
        if (callback(
          currentSegment,
          featureIndex,
          multiFeatureIndex,
          geometryIndex,
          segmentIndex
        ) === false)
          return false;
        segmentIndex++;
        previousCoords = currentCoord;
      }
    ) === false)
      return false;
  });
}
function segmentReduce(geojson, callback, initialValue) {
  var previousValue = initialValue;
  var started = false;
  segmentEach(
    geojson,
    function(currentSegment, featureIndex, multiFeatureIndex, geometryIndex, segmentIndex) {
      if (started === false && initialValue === void 0)
        previousValue = currentSegment;
      else
        previousValue = callback(
          previousValue,
          currentSegment,
          featureIndex,
          multiFeatureIndex,
          geometryIndex,
          segmentIndex
        );
      started = true;
    }
  );
  return previousValue;
}
function lineEach(geojson, callback) {
  if (!geojson) throw new Error("geojson is required");
  flattenEach(geojson, function(feature2, featureIndex, multiFeatureIndex) {
    if (feature2.geometry === null) return;
    var type = feature2.geometry.type;
    var coords = feature2.geometry.coordinates;
    switch (type) {
      case "LineString":
        if (callback(feature2, featureIndex, multiFeatureIndex, 0, 0) === false)
          return false;
        break;
      case "Polygon":
        for (var geometryIndex = 0; geometryIndex < coords.length; geometryIndex++) {
          if (callback(
            _helpers.lineString.call(void 0, coords[geometryIndex], feature2.properties),
            featureIndex,
            multiFeatureIndex,
            geometryIndex
          ) === false)
            return false;
        }
        break;
    }
  });
}
function lineReduce(geojson, callback, initialValue) {
  var previousValue = initialValue;
  lineEach(
    geojson,
    function(currentLine, featureIndex, multiFeatureIndex, geometryIndex) {
      if (featureIndex === 0 && initialValue === void 0)
        previousValue = currentLine;
      else
        previousValue = callback(
          previousValue,
          currentLine,
          featureIndex,
          multiFeatureIndex,
          geometryIndex
        );
    }
  );
  return previousValue;
}
function findSegment(geojson, options) {
  options = options || {};
  if (!_helpers.isObject.call(void 0, options)) throw new Error("options is invalid");
  var featureIndex = options.featureIndex || 0;
  var multiFeatureIndex = options.multiFeatureIndex || 0;
  var geometryIndex = options.geometryIndex || 0;
  var segmentIndex = options.segmentIndex || 0;
  var properties = options.properties;
  var geometry;
  switch (geojson.type) {
    case "FeatureCollection":
      if (featureIndex < 0)
        featureIndex = geojson.features.length + featureIndex;
      properties = properties || geojson.features[featureIndex].properties;
      geometry = geojson.features[featureIndex].geometry;
      break;
    case "Feature":
      properties = properties || geojson.properties;
      geometry = geojson.geometry;
      break;
    case "Point":
    case "MultiPoint":
      return null;
    case "LineString":
    case "Polygon":
    case "MultiLineString":
    case "MultiPolygon":
      geometry = geojson;
      break;
    default:
      throw new Error("geojson is invalid");
  }
  if (geometry === null) return null;
  var coords = geometry.coordinates;
  switch (geometry.type) {
    case "Point":
    case "MultiPoint":
      return null;
    case "LineString":
      if (segmentIndex < 0) segmentIndex = coords.length + segmentIndex - 1;
      return _helpers.lineString.call(void 0, 
        [coords[segmentIndex], coords[segmentIndex + 1]],
        properties,
        options
      );
    case "Polygon":
      if (geometryIndex < 0) geometryIndex = coords.length + geometryIndex;
      if (segmentIndex < 0)
        segmentIndex = coords[geometryIndex].length + segmentIndex - 1;
      return _helpers.lineString.call(void 0, 
        [
          coords[geometryIndex][segmentIndex],
          coords[geometryIndex][segmentIndex + 1]
        ],
        properties,
        options
      );
    case "MultiLineString":
      if (multiFeatureIndex < 0)
        multiFeatureIndex = coords.length + multiFeatureIndex;
      if (segmentIndex < 0)
        segmentIndex = coords[multiFeatureIndex].length + segmentIndex - 1;
      return _helpers.lineString.call(void 0, 
        [
          coords[multiFeatureIndex][segmentIndex],
          coords[multiFeatureIndex][segmentIndex + 1]
        ],
        properties,
        options
      );
    case "MultiPolygon":
      if (multiFeatureIndex < 0)
        multiFeatureIndex = coords.length + multiFeatureIndex;
      if (geometryIndex < 0)
        geometryIndex = coords[multiFeatureIndex].length + geometryIndex;
      if (segmentIndex < 0)
        segmentIndex = coords[multiFeatureIndex][geometryIndex].length - segmentIndex - 1;
      return _helpers.lineString.call(void 0, 
        [
          coords[multiFeatureIndex][geometryIndex][segmentIndex],
          coords[multiFeatureIndex][geometryIndex][segmentIndex + 1]
        ],
        properties,
        options
      );
  }
  throw new Error("geojson is invalid");
}
function findPoint(geojson, options) {
  options = options || {};
  if (!_helpers.isObject.call(void 0, options)) throw new Error("options is invalid");
  var featureIndex = options.featureIndex || 0;
  var multiFeatureIndex = options.multiFeatureIndex || 0;
  var geometryIndex = options.geometryIndex || 0;
  var coordIndex = options.coordIndex || 0;
  var properties = options.properties;
  var geometry;
  switch (geojson.type) {
    case "FeatureCollection":
      if (featureIndex < 0)
        featureIndex = geojson.features.length + featureIndex;
      properties = properties || geojson.features[featureIndex].properties;
      geometry = geojson.features[featureIndex].geometry;
      break;
    case "Feature":
      properties = properties || geojson.properties;
      geometry = geojson.geometry;
      break;
    case "Point":
    case "MultiPoint":
      return null;
    case "LineString":
    case "Polygon":
    case "MultiLineString":
    case "MultiPolygon":
      geometry = geojson;
      break;
    default:
      throw new Error("geojson is invalid");
  }
  if (geometry === null) return null;
  var coords = geometry.coordinates;
  switch (geometry.type) {
    case "Point":
      return _helpers.point.call(void 0, coords, properties, options);
    case "MultiPoint":
      if (multiFeatureIndex < 0)
        multiFeatureIndex = coords.length + multiFeatureIndex;
      return _helpers.point.call(void 0, coords[multiFeatureIndex], properties, options);
    case "LineString":
      if (coordIndex < 0) coordIndex = coords.length + coordIndex;
      return _helpers.point.call(void 0, coords[coordIndex], properties, options);
    case "Polygon":
      if (geometryIndex < 0) geometryIndex = coords.length + geometryIndex;
      if (coordIndex < 0)
        coordIndex = coords[geometryIndex].length + coordIndex;
      return _helpers.point.call(void 0, coords[geometryIndex][coordIndex], properties, options);
    case "MultiLineString":
      if (multiFeatureIndex < 0)
        multiFeatureIndex = coords.length + multiFeatureIndex;
      if (coordIndex < 0)
        coordIndex = coords[multiFeatureIndex].length + coordIndex;
      return _helpers.point.call(void 0, coords[multiFeatureIndex][coordIndex], properties, options);
    case "MultiPolygon":
      if (multiFeatureIndex < 0)
        multiFeatureIndex = coords.length + multiFeatureIndex;
      if (geometryIndex < 0)
        geometryIndex = coords[multiFeatureIndex].length + geometryIndex;
      if (coordIndex < 0)
        coordIndex = coords[multiFeatureIndex][geometryIndex].length - coordIndex;
      return _helpers.point.call(void 0, 
        coords[multiFeatureIndex][geometryIndex][coordIndex],
        properties,
        options
      );
  }
  throw new Error("geojson is invalid");
}


















exports.coordAll = coordAll; exports.coordEach = coordEach; exports.coordReduce = coordReduce; exports.featureEach = featureEach; exports.featureReduce = featureReduce; exports.findPoint = findPoint; exports.findSegment = findSegment; exports.flattenEach = flattenEach; exports.flattenReduce = flattenReduce; exports.geomEach = geomEach; exports.geomReduce = geomReduce; exports.lineEach = lineEach; exports.lineReduce = lineReduce; exports.propEach = propEach; exports.propReduce = propReduce; exports.segmentEach = segmentEach; exports.segmentReduce = segmentReduce;

},{"@turf/helpers":5}],8:[function(require,module,exports){
'use strict';

var epsilon = 1.1102230246251565e-16;
var splitter = 134217729;
var resulterrbound = (3 + 8 * epsilon) * epsilon;

// fast_expansion_sum_zeroelim routine from oritinal code
function sum(elen, e, flen, f, h) {
    var Q, Qnew, hh, bvirt;
    var enow = e[0];
    var fnow = f[0];
    var eindex = 0;
    var findex = 0;
    if ((fnow > enow) === (fnow > -enow)) {
        Q = enow;
        enow = e[++eindex];
    } else {
        Q = fnow;
        fnow = f[++findex];
    }
    var hindex = 0;
    if (eindex < elen && findex < flen) {
        if ((fnow > enow) === (fnow > -enow)) {
            Qnew = enow + Q;
            hh = Q - (Qnew - enow);
            enow = e[++eindex];
        } else {
            Qnew = fnow + Q;
            hh = Q - (Qnew - fnow);
            fnow = f[++findex];
        }
        Q = Qnew;
        if (hh !== 0) {
            h[hindex++] = hh;
        }
        while (eindex < elen && findex < flen) {
            if ((fnow > enow) === (fnow > -enow)) {
                Qnew = Q + enow;
                bvirt = Qnew - Q;
                hh = Q - (Qnew - bvirt) + (enow - bvirt);
                enow = e[++eindex];
            } else {
                Qnew = Q + fnow;
                bvirt = Qnew - Q;
                hh = Q - (Qnew - bvirt) + (fnow - bvirt);
                fnow = f[++findex];
            }
            Q = Qnew;
            if (hh !== 0) {
                h[hindex++] = hh;
            }
        }
    }
    while (eindex < elen) {
        Qnew = Q + enow;
        bvirt = Qnew - Q;
        hh = Q - (Qnew - bvirt) + (enow - bvirt);
        enow = e[++eindex];
        Q = Qnew;
        if (hh !== 0) {
            h[hindex++] = hh;
        }
    }
    while (findex < flen) {
        Qnew = Q + fnow;
        bvirt = Qnew - Q;
        hh = Q - (Qnew - bvirt) + (fnow - bvirt);
        fnow = f[++findex];
        Q = Qnew;
        if (hh !== 0) {
            h[hindex++] = hh;
        }
    }
    if (Q !== 0 || hindex === 0) {
        h[hindex++] = Q;
    }
    return hindex;
}

function estimate(elen, e) {
    var Q = e[0];
    for (var i = 1; i < elen; i++) { Q += e[i]; }
    return Q;
}

function vec(n) {
    return new Float64Array(n);
}

var ccwerrboundA = (3 + 16 * epsilon) * epsilon;
var ccwerrboundB = (2 + 12 * epsilon) * epsilon;
var ccwerrboundC = (9 + 64 * epsilon) * epsilon * epsilon;

var B = vec(4);
var C1 = vec(8);
var C2 = vec(12);
var D = vec(16);
var u = vec(4);

function orient2dadapt(ax, ay, bx, by, cx, cy, detsum) {
    var acxtail, acytail, bcxtail, bcytail;
    var bvirt, c, ahi, alo, bhi, blo, _i, _j, _0, s1, s0, t1, t0, u3;

    var acx = ax - cx;
    var bcx = bx - cx;
    var acy = ay - cy;
    var bcy = by - cy;

    s1 = acx * bcy;
    c = splitter * acx;
    ahi = c - (c - acx);
    alo = acx - ahi;
    c = splitter * bcy;
    bhi = c - (c - bcy);
    blo = bcy - bhi;
    s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
    t1 = acy * bcx;
    c = splitter * acy;
    ahi = c - (c - acy);
    alo = acy - ahi;
    c = splitter * bcx;
    bhi = c - (c - bcx);
    blo = bcx - bhi;
    t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
    _i = s0 - t0;
    bvirt = s0 - _i;
    B[0] = s0 - (_i + bvirt) + (bvirt - t0);
    _j = s1 + _i;
    bvirt = _j - s1;
    _0 = s1 - (_j - bvirt) + (_i - bvirt);
    _i = _0 - t1;
    bvirt = _0 - _i;
    B[1] = _0 - (_i + bvirt) + (bvirt - t1);
    u3 = _j + _i;
    bvirt = u3 - _j;
    B[2] = _j - (u3 - bvirt) + (_i - bvirt);
    B[3] = u3;

    var det = estimate(4, B);
    var errbound = ccwerrboundB * detsum;
    if (det >= errbound || -det >= errbound) {
        return det;
    }

    bvirt = ax - acx;
    acxtail = ax - (acx + bvirt) + (bvirt - cx);
    bvirt = bx - bcx;
    bcxtail = bx - (bcx + bvirt) + (bvirt - cx);
    bvirt = ay - acy;
    acytail = ay - (acy + bvirt) + (bvirt - cy);
    bvirt = by - bcy;
    bcytail = by - (bcy + bvirt) + (bvirt - cy);

    if (acxtail === 0 && acytail === 0 && bcxtail === 0 && bcytail === 0) {
        return det;
    }

    errbound = ccwerrboundC * detsum + resulterrbound * Math.abs(det);
    det += (acx * bcytail + bcy * acxtail) - (acy * bcxtail + bcx * acytail);
    if (det >= errbound || -det >= errbound) { return det; }

    s1 = acxtail * bcy;
    c = splitter * acxtail;
    ahi = c - (c - acxtail);
    alo = acxtail - ahi;
    c = splitter * bcy;
    bhi = c - (c - bcy);
    blo = bcy - bhi;
    s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
    t1 = acytail * bcx;
    c = splitter * acytail;
    ahi = c - (c - acytail);
    alo = acytail - ahi;
    c = splitter * bcx;
    bhi = c - (c - bcx);
    blo = bcx - bhi;
    t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
    _i = s0 - t0;
    bvirt = s0 - _i;
    u[0] = s0 - (_i + bvirt) + (bvirt - t0);
    _j = s1 + _i;
    bvirt = _j - s1;
    _0 = s1 - (_j - bvirt) + (_i - bvirt);
    _i = _0 - t1;
    bvirt = _0 - _i;
    u[1] = _0 - (_i + bvirt) + (bvirt - t1);
    u3 = _j + _i;
    bvirt = u3 - _j;
    u[2] = _j - (u3 - bvirt) + (_i - bvirt);
    u[3] = u3;
    var C1len = sum(4, B, 4, u, C1);

    s1 = acx * bcytail;
    c = splitter * acx;
    ahi = c - (c - acx);
    alo = acx - ahi;
    c = splitter * bcytail;
    bhi = c - (c - bcytail);
    blo = bcytail - bhi;
    s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
    t1 = acy * bcxtail;
    c = splitter * acy;
    ahi = c - (c - acy);
    alo = acy - ahi;
    c = splitter * bcxtail;
    bhi = c - (c - bcxtail);
    blo = bcxtail - bhi;
    t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
    _i = s0 - t0;
    bvirt = s0 - _i;
    u[0] = s0 - (_i + bvirt) + (bvirt - t0);
    _j = s1 + _i;
    bvirt = _j - s1;
    _0 = s1 - (_j - bvirt) + (_i - bvirt);
    _i = _0 - t1;
    bvirt = _0 - _i;
    u[1] = _0 - (_i + bvirt) + (bvirt - t1);
    u3 = _j + _i;
    bvirt = u3 - _j;
    u[2] = _j - (u3 - bvirt) + (_i - bvirt);
    u[3] = u3;
    var C2len = sum(C1len, C1, 4, u, C2);

    s1 = acxtail * bcytail;
    c = splitter * acxtail;
    ahi = c - (c - acxtail);
    alo = acxtail - ahi;
    c = splitter * bcytail;
    bhi = c - (c - bcytail);
    blo = bcytail - bhi;
    s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
    t1 = acytail * bcxtail;
    c = splitter * acytail;
    ahi = c - (c - acytail);
    alo = acytail - ahi;
    c = splitter * bcxtail;
    bhi = c - (c - bcxtail);
    blo = bcxtail - bhi;
    t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
    _i = s0 - t0;
    bvirt = s0 - _i;
    u[0] = s0 - (_i + bvirt) + (bvirt - t0);
    _j = s1 + _i;
    bvirt = _j - s1;
    _0 = s1 - (_j - bvirt) + (_i - bvirt);
    _i = _0 - t1;
    bvirt = _0 - _i;
    u[1] = _0 - (_i + bvirt) + (bvirt - t1);
    u3 = _j + _i;
    bvirt = u3 - _j;
    u[2] = _j - (u3 - bvirt) + (_i - bvirt);
    u[3] = u3;
    var Dlen = sum(C2len, C2, 4, u, D);

    return D[Dlen - 1];
}

function orient2d(ax, ay, bx, by, cx, cy) {
    var detleft = (ay - cy) * (bx - cx);
    var detright = (ax - cx) * (by - cy);
    var det = detleft - detright;

    var detsum = Math.abs(detleft + detright);
    if (Math.abs(det) >= ccwerrboundA * detsum) { return det; }

    return -orient2dadapt(ax, ay, bx, by, cx, cy, detsum);
}

function pointInPolygon(p, polygon) {
    var i;
    var ii;
    var k = 0;
    var f;
    var u1;
    var v1;
    var u2;
    var v2;
    var currentP;
    var nextP;

    var x = p[0];
    var y = p[1];

    var numContours = polygon.length;
    for (i = 0; i < numContours; i++) {
        ii = 0;
        var contour = polygon[i];
        var contourLen = contour.length - 1;

        currentP = contour[0];
        if (currentP[0] !== contour[contourLen][0] &&
            currentP[1] !== contour[contourLen][1]) {
            throw new Error('First and last coordinates in a ring must be the same')
        }

        u1 = currentP[0] - x;
        v1 = currentP[1] - y;

        for (ii; ii < contourLen; ii++) {
            nextP = contour[ii + 1];

            u2 = nextP[0] - x;
            v2 = nextP[1] - y;

            if (v1 === 0 && v2 === 0) {
                if ((u2 <= 0 && u1 >= 0) || (u1 <= 0 && u2 >= 0)) { return 0 }
            } else if ((v2 >= 0 && v1 <= 0) || (v2 <= 0 && v1 >= 0)) {
                f = orient2d(u1, u2, v1, v2, 0, 0);
                if (f === 0) { return 0 }
                if ((f > 0 && v2 > 0 && v1 <= 0) || (f < 0 && v2 <= 0 && v1 > 0)) { k++; }
            }
            currentP = nextP;
            v1 = v2;
            u1 = u2;
        }
    }

    if (k % 2 === 0) { return false }
    return true
}

module.exports = pointInPolygon;

},{}]},{},[2])(2)
});
