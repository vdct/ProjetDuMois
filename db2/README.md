# Database set-up

Make sure you have a PostgreSQL and PostGIS database ready to use.

Copy and rename `example.env` into `.env` and change settings accordingly.

The `settings` folder will contain your input data:

- Add it your `.osh.pbf` file
- Change if necessary the `clip.poly` file to match your area

## Running

```bash
docker compose \
	-f docker-compose.yml \
	-f docker-compose.develop.yml \
	-f docker-compose.build.yml \
	-f docker-compose-imposm.yml \
	up --build
```
