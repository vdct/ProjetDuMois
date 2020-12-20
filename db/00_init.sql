-- User names
CREATE TABLE pdm_user_names(
	userid BIGINT PRIMARY KEY,
	username VARCHAR NOT NULL
);

CREATE INDEX ON pdm_user_names(userid);

-- User contributions through all projects
CREATE TABLE pdm_user_contribs(
	project VARCHAR NOT NULL,
	userid BIGINT NOT NULL,
	ts TIMESTAMP NOT NULL,
	contribution VARCHAR NOT NULL,
	verified BOOLEAN NOT NULL DEFAULT TRUE,
	points INT NOT NULL DEFAULT 1
);

CREATE INDEX ON pdm_user_contribs(project);
CREATE INDEX ON pdm_user_contribs(userid);

-- User badges
DROP TABLE IF EXISTS pdm_user_badges;

-- Features counts
CREATE TABLE pdm_feature_counts(
	project VARCHAR NOT NULL,
	ts TIMESTAMP NOT NULL,
	amount INT NOT NULL
);

CREATE INDEX ON pdm_feature_counts(project);

-- Note counts
CREATE TABLE pdm_note_counts(
	project VARCHAR NOT NULL,
	ts TIMESTAMP NOT NULL,
	open INT NOT NULL,
	closed INT NOT NULL
);

CREATE INDEX ON pdm_note_counts(project);

-- Extensions for Imposm
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS hstore;

-- Leaderboard view
CREATE OR REPLACE VIEW pdm_leaderboard AS
WITH stats AS (
	SELECT userid, project, SUM(points) AS amount
	FROM pdm_user_contribs
	GROUP BY userid, project
	ORDER BY SUM(points) DESC
), scores AS (
	SELECT project, row_number() over (PARTITION BY project ORDER BY amount DESC) AS pos, amount
	FROM (
		SELECT DISTINCT project, amount
		FROM stats
		ORDER BY project, amount DESC
	) a
)
SELECT st.project, st.userid, un.username, st.amount, sc.pos
FROM stats st
JOIN scores sc ON st.project = sc.project AND sc.amount = st.amount
JOIN pdm_user_names un ON st.userid = un.userid;

-- OSM compare feature exclusions
CREATE TABLE pdm_compare_exclusions(
	project VARCHAR NOT NULL,
	osm_id VARCHAR NOT NULL,
	ts TIMESTAMP NOT NULL DEFAULT current_timestamp,
	userid BIGINT,
	CONSTRAINT pdm_compare_exclusions_pk PRIMARY KEY(project, osm_id)
);
