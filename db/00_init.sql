-- User names
CREATE TABLE user_names(
	userid BIGINT PRIMARY KEY,
	username VARCHAR NOT NULL
);

-- User contributions through all projects
CREATE TABLE user_contributions(
	project VARCHAR NOT NULL,
	userid BIGINT NOT NULL,
	ts TIMESTAMP NOT NULL,
	contribution VARCHAR NOT NULL
);

CREATE INDEX user_contributions_project_idx ON user_contributions(project);
CREATE INDEX user_contributions_userid_idx ON user_contributions(userid);
