-- User names
CREATE TABLE pdm_user_names(
	userid BIGINT NOT NULL,
	username VARCHAR NOT NULL,
	CONSTRAINT pdm_user_names_pk PRIMARY KEY(userid)
);

-- Projects
CREATE TABLE pdm_projects(
	project_id int primary key,
	project VARCHAR,
	start_date TIMESTAMP NOT NULL,
	end_date TIMESTAMP NULL,
	changes_lastupdate_date TIMESTAMP NULL,
	counts_lastupdate_date TIMESTAMP NULL
);

CREATE TABLE pdm_projects_points (
	project_id int,
	contrib VARCHAR,
	label VARCHAR default null,
	points integer not null,

	CONSTRAINT pdm_projects_points_unique UNIQUE NULLS NOT DISTINCT (project_id, contrib, label)
);

CREATE TABLE pdm_projects_teams (
	project_id int,
	team varchar,
	username varchar,
	userid bigint default null,
	PRIMARY KEY (project_id,team,username)
);

-- Users contributions
-- No osmid, then no primary key on this table (several contribs can occur at the same ts)
CREATE TABLE pdm_user_contribs(
	project_id int NOT NULL,
	userid BIGINT NOT NULL,
	ts DATE NOT NULL,
	label varchar default null,
	contribution VARCHAR NOT NULL,
	verified BOOLEAN NOT NULL DEFAULT TRUE,
	amount_delta INT NOT NULL DEFAULT 0,
	len_delta numeric default 0,
	area_delta numeric default 0,
	points INT DEFAULT 1
);

CREATE INDEX ON pdm_user_contribs(project_id);
CREATE INDEX ON pdm_user_contribs(userid);

-- User badges
DROP TABLE IF EXISTS pdm_user_badges;

-- Overall counts
CREATE TABLE pdm_feature_counts(
	project_id int NOT NULL,
	ts TIMESTAMP NOT NULL,
	label varchar,
	amount INT NOT NULL,
	len numeric not null,
	area numeric not null,

	CONSTRAINT pdm_feature_counts_unique UNIQUE NULLS NOT DISTINCT(project_id, ts, label)
);

CREATE INDEX ON pdm_feature_counts(project_id);

CREATE TABLE pdm_mapper_counts(
	project_id int NOT NULL,
	ts TIMESTAMP NOT NULL,
	label varchar,
	amount INT NOT NULL,
	amount_1d INT NOT NULL,
	amount_30d INT NOT NULL,

	CONSTRAINT pdm_mapper_counts_unique UNIQUE NULLS NOT DISTINCT(project_id, ts, label)
);

CREATE INDEX ON pdm_mapper_counts(project_id);

-- Boundary counts
CREATE TABLE pdm_feature_counts_per_boundary(
	project_id int NOT NULL,
	boundary BIGINT NOT NULL,
	ts TIMESTAMP NOT NULL,
	label varchar,
	amount INT NOT NULL,
	len numeric not null,
	area numeric not null,
	
	CONSTRAINT pdm_feature_counts_per_boundary_unique UNIQUE NULLS NOT DISTINCT(project_id, boundary, ts, label)
);

CREATE INDEX ON pdm_feature_counts_per_boundary using btree (project_id);
CREATE INDEX ON pdm_feature_counts_per_boundary using btree (boundary);

CREATE TABLE pdm_mapper_counts_per_boundary(
	project_id int NOT NULL,
	boundary BIGINT NOT NULL,
	ts TIMESTAMP NOT NULL,
	label varchar,
	amount INT NOT NULL,
	amount_1d INT NOT NULL,
	amount_30d INT NOT NULL,

	CONSTRAINT pdm_mapper_counts_per_boundary_unique UNIQUE NULLS NOT DISTINCT(project_id, boundary, ts, label)
);

CREATE INDEX ON pdm_mapper_counts_per_boundary using btree (project_id);
CREATE INDEX ON pdm_mapper_counts_per_boundary using btree (boundary);

-- Note counts
CREATE TABLE pdm_note_counts(
	project_id int NOT NULL,
	ts TIMESTAMP NOT NULL,
	open INT NOT NULL,
	closed INT NOT NULL
);

CREATE INDEX ON pdm_note_counts(project_id);

-- Leaderboard view
CREATE OR REPLACE VIEW pdm_leaderboard AS
WITH stats AS (
	SELECT uc.userid, uc.project_id, p.project, SUM(uc.points) AS amount
	FROM pdm_user_contribs uc
	JOIn pdm_projects p ON uc.project_id=p.project_id
	GROUP BY uc.userid, uc.project_id, p.project
	ORDER BY SUM(uc.points) DESC
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
	project_id int NOT NULL,
	osm_id VARCHAR NOT NULL,
	ts TIMESTAMP NOT NULL DEFAULT current_timestamp,
	userid BIGINT,
	CONSTRAINT pdm_compare_exclusions_pk PRIMARY KEY(project_id, osm_id)
);

-- Function to generate badges for a single user and project
CREATE OR REPLACE FUNCTION pdm_get_badges(the_project VARCHAR, the_userid BIGINT) RETURNS TABLE (id VARCHAR, name VARCHAR, description VARCHAR, acquired BOOLEAN, progress INT) AS $$
DECLARE
	nb_contributions INT;
	result_userid BIGINT;
	result_count INT;
	result_position INT;
BEGIN
	-- Common badges to all projects
	IF the_project != 'meta' THEN
		-- Amount of contributions
		SELECT amount, pos INTO nb_contributions, result_position
		FROM pdm_leaderboard
		WHERE project = the_project AND userid = the_userid;

		-- 1st, 2nd and 3rd position
		IF result_position <= 3 THEN
			id := CASE WHEN result_position = 1 THEN 'score_1st' WHEN result_position = 2 THEN 'score_2nd' ELSE 'score_3rd' END;
			name := CASE WHEN result_position = 1 THEN '1ère place' WHEN result_position = 2 THEN '2ème place' ELSE '3ème place' END;
			description := 'Vous êtes sur le podium, félicitations !';
			acquired := true;
			progress := 100;
			RETURN next;
		-- Near podium
		ELSIF result_position <= 10 THEN
			id := 'score_3rd';
			name := 'Près du podium';
			description := 'Vous n''êtes qu''à quelques points d''être sur le podium !';
			acquired := false;
			progress := FLOOR((result_position - 3)::float / 7 * 100);
			RETURN next;
		END IF;

		-- Badges related to amount of contributions
		IF nb_contributions < 3 THEN
			id := '1_edit';
			name := '1er point';
			description := 'Lancez-vous dans l''aventure';
			acquired := nb_contributions >= 1;
			progress := acquired::INT * 100;
			RETURN next;
		END IF;

		IF nb_contributions BETWEEN 1 AND 5 THEN
			id := '3_edits';
			name := '3+ points';
			description := 'Premiers pas';
			acquired := nb_contributions >= 3;
			progress := FLOOR(LEAST(nb_contributions, 3)::FLOAT / 3 * 100);
			RETURN next;
		END IF;

		IF nb_contributions BETWEEN 3 AND 9 THEN
			id := '6_edits';
			name := '6+ points';
			description := 'Bien parti';
			acquired := nb_contributions >= 6;
			progress := FLOOR(LEAST(nb_contributions, 6)::FLOAT / 6 * 100);
			RETURN next;
		END IF;

		IF nb_contributions BETWEEN 6 AND 29 THEN
			id := '10_edits';
			name := '10+ points';
			description := 'Envie d''aller un peu plus loin';
			acquired := nb_contributions >= 10;
			progress := FLOOR(LEAST(nb_contributions, 10)::FLOAT / 10 * 100);
			RETURN next;
		END IF;

		IF nb_contributions BETWEEN 10 AND 41 THEN
			id := '30_edits';
			name := '30+ points';
			description := 'J''aime bien c''est sympa comme projet';
			acquired := nb_contributions >= 30;
			progress := FLOOR(LEAST(nb_contributions, 30)::FLOAT / 30 * 100);
			RETURN next;
		END IF;

		IF nb_contributions BETWEEN 30 AND 69 THEN
			id := '42_edits';
			name := '42+ points';
			description := 'La réponse à la grande question sur la vie, l''univers et le reste';
			acquired := nb_contributions >= 42;
			progress := FLOOR(LEAST(nb_contributions, 42)::FLOAT / 42 * 100);
			RETURN next;
		END IF;

		IF nb_contributions BETWEEN 42 AND 99 THEN
			id := '70_edits';
			name := '70+ points';
			description := '70 points par heure, tout s''accélère';
			acquired := nb_contributions >= 70;
			progress := FLOOR(LEAST(nb_contributions, 70)::FLOAT / 70 * 100);
			RETURN next;
		END IF;

		IF nb_contributions BETWEEN 70 AND 499 THEN
			id := '100_edits';
			name := '100+ points';
			description := 'Et de 100 !';
			acquired := nb_contributions >= 100;
			progress := LEAST(nb_contributions, 100);
			RETURN next;
		END IF;

		IF nb_contributions >= 100 THEN
			id := '500_edits';
			name := '500+ points';
			description := 'Objectif Lune';
			acquired := nb_contributions >= 500;
			progress := FLOOR(LEAST(nb_contributions, 500)::FLOAT / 500 * 100);
			RETURN next;
		END IF;
	-- Meta badges
	ELSE
		-- Best contributor through all projects
		SELECT userid, COUNT(*) INTO result_userid, result_count
		FROM pdm_user_contribs
		GROUP BY userid
		ORDER BY COUNT(*) DESC
		LIMIT 1;

		id := 'best_contributor';
		name := 'N°1 des contributions';
		acquired := result_userid = the_userid;

		IF acquired THEN
			progress := 100;
			description := 'Le plus de points sur l''ensemble des projets';
			RETURN next;
		ELSE
			SELECT COUNT(*)::FLOAT / result_count * 100 INTO progress
			FROM pdm_user_contribs
			WHERE userid = the_userid;
			IF progress >= 50 THEN
				description := 'Détronez la personne ayant le plus de points à ce jour';
				RETURN next;
			END IF;
		END IF;
	END IF;
END;
$$ LANGUAGE plpgsql
IMMUTABLE ROWS 100;
