-- Insert unknown members in table
\timing
CREATE INDEX ON :members_table_tmp using btree(osmid, version, memberid, pos);

WITH unknown AS (
	SELECT tmp.*
	FROM :members_table_tmp tmp
	LEFT JOIN :members_table pc ON pc.osmid=tmp.osmid AND pc.version=tmp.version AND pc.memberid=tmp.memberid AND pc.pos=tmp.pos
	WHERE pc.osmid IS NULL
)
INSERT INTO :members_table
SELECT u.*
FROM unknown u;

ANALYSE :members_table;
