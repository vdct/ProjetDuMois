ANALYZE :features_table;
ANALYZE :members_table;

CREATE INDEX ON :features_table (osmid, version);
CREATE INDEX ON :features_table (action, tagsfilter);
CREATE INDEX ON :features_table (ts);
CREATE INDEX ON :features_table (userid);
CREATE INDEX ON :features_table using gist(geom);
CREATE INDEX ON :features_table using gin(tags);

CREATE INDEX ON :update_table using gist(geom);

CREATE INDEX ON :members_table (osmid, version, memberid, pos);
CREATE INDEX ON :members_table (osmid, version);
CREATE INDEX ON :members_table (memberid);

CREATE INDEX ON :changes_table (osmid, version);
CREATE INDEX ON :changes_table (action, tagsfilter);
CREATE INDEX ON :changes_table (ts_start, ts_end);
CREATE INDEX ON :changes_table using gist(geom);

CREATE INDEX ON :labels_table USING btree(osmid, version);
CREATE INDEX ON :labels_table USING btree(label);

CREATE INDEX ON :boundary_table USING btree(osmid, version);
CREATE INDEX ON :boundary_table USING btree(boundary);
