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
CREATE TABLE user_badges(
	userid BIGINT NOT NULL,
	project VARCHAR NOT NULL,
	badge VARCHAR NOT NULL,
	ts TIMESTAMP NOT NULL DEFAULT current_timestamp,
	PRIMARY KEY (userid, project, badge)
);

CREATE INDEX user_badges_userid_idx ON user_badges(userid);
CREATE INDEX user_badges_project_idx ON user_badges(project);

-- Features counts
CREATE TABLE feature_counts(
	project VARCHAR NOT NULL,
	ts TIMESTAMP NOT NULL,
	amount INT NOT NULL
);

CREATE INDEX feature_counts_project_idx ON feature_counts(project);
