-- Project specific badges
CREATE TABLE badges(
	id INT PRIMARY KEY,
	name VARCHAR NOT NULL,
	description VARCHAR NOT NULL
);

-- User names
CREATE TABLE user_names(
	userid VARCHAR PRIMARY KEY,
	username VARCHAR NOT NULL
);

-- Badges won by contributors
CREATE TABLE user_badges(
	userid VARCHAR NOT NULL,
	ts TIMESTAMP NOT NULL DEFAULT current_timestamp,
	badge INT NOT NULL REFERENCES badges(id)
);

-- Contributions types
CREATE TABLE contributions(
	id VARCHAR PRIMARY KEY,
	name VARCHAR NOT NULL
);

-- User contributions
CREATE TABLE user_contributions(
	userid VARCHAR NOT NULL,
	ts TIMESTAMP NOT NULL,
	contribution VARCHAR NOT NULL REFERENCES contributions(id)
);
