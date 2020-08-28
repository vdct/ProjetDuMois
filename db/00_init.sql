-- User names
CREATE TABLE user_names(
	userid BIGINT PRIMARY KEY,
	username VARCHAR NOT NULL
);

CREATE INDEX user_names_userid_idx ON user_names(userid);

-- User contributions through all projects
CREATE TABLE user_contributions(
	project VARCHAR NOT NULL,
	userid BIGINT NOT NULL,
	ts TIMESTAMP NOT NULL,
	contribution VARCHAR NOT NULL
);

CREATE INDEX user_contributions_project_idx ON user_contributions(project);
CREATE INDEX user_contributions_userid_idx ON user_contributions(userid);

-- User badges
DROP TABLE IF EXISTS user_badges;

-- Features counts
CREATE TABLE feature_counts(
	project VARCHAR NOT NULL,
	ts TIMESTAMP NOT NULL,
	amount INT NOT NULL
);

CREATE INDEX feature_counts_project_idx ON feature_counts(project);

-- Note counts
CREATE TABLE note_counts(
	project VARCHAR NOT NULL,
	ts TIMESTAMP NOT NULL,
	open INT NOT NULL,
	closed INT NOT NULL
);

CREATE INDEX note_counts_project_idx ON note_counts(project);

-- Extensions for Imposm
CREATE EXTENSION postgis;
CREATE EXTENSION hstore;

-- Leaderboard view
CREATE VIEW leaderboard AS
WITH stats AS (
	SELECT userid, project, COUNT(*) AS amount
	FROM user_contributions
	GROUP BY userid, project
	ORDER BY COUNT(*) DESC
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
JOIN user_names un ON st.userid = un.userid;
