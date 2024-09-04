# Database

```bash
# From repo root
python -m venv env
source ./env/bin/activate
pip install -r requirements.txt

# Init database
export DB_URL=postgres://user:pass@host:port/db
psql $DB_URL -f db2/00_init.sql

# Install project (must be done when new project is created as well)
python db2/10_init_projects.py

# Update Imposm features to latest OSM state (runs forever, should be launched in background)
python db2/20_update_imposm.py &

# Daily updates (for boundaries stats)
python db2/30_update_db_daily.py
```
