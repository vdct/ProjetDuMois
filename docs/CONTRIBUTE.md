# Continuous improvement and propose changes

Improvement and changes are welcome to keep this project alive and help would be particularly needed on following topics:
- Features supports, particularly the most advanced ones like ways and relations
- Osmium integration and usage
- Performance tunning
- KPI computation
- User experience and interface functionnality

### Standard of operation

This software is intended to foster contribution on specific topics and process large amount of data coming from OpenStreetMap history files and daily diffs.  
As of 2025, following hardware is a minimum requirement to evaluate performance of a proposed change:
- Modern 8-core CPU
- 32 Go RAM
- 1 To SSD

It should be possible to populate the database with 1-year long, ~ 30 millions of versions changelog from the world history file in less than 4-hours of processing.  
You may find below some typical configurations that allow to process such amount of data.

### Test your changes

Processing are complex and changes relevancy should be evaluated across different scenarios.  
It is then recommended to build a testing database and evaluate processing times on national and worldwide projects, such as ones available in the master branch.

You can refer to [operating documentation](./DEVELOP.md) to run your own instance.

It's not necessary to configure a whole project to be able to run a process. Here are some configuration samples to help you:

Worldwide configuration, `config.json`
```json
{
  "OSH_PBF_AUTHORIZED": false,
  "OSH_PBF_URL": "https://planet.openstreetmap.org/pbf/full-history/history-latest.osm.pbf",
  "OSM_PBF_URL": "https://planet.openstreetmap.org/pbf/planet-latest.osm.pbf",
  "POLY_URL": null
}
```

Country scale configuration, here France, `config.json`
```json
{
  "OSM_USER": "Your_osm_account",
  "OSM_PASS": "Your_osm_password",
  "OSM_CLIENT_ID": "Your_osm_oauth2_clientid",
  "OSM_API_URL": "https://api.openstreetmap.org",
  "OSH_PBF_AUTHORIZED": true,
  "OSH_PBF_URL": "https://osm-internal.download.geofabrik.de/europe/france-internal.osh.pbf",
  "OSM_PBF_URL": "https://download.geofabrik.de/europe/france-latest.osm.pbf",
  "POLY_URL": "https://download.geofabrik.de/europe/france.poly"
}
```

Geofabrik's server should be used responsibly during your tests.  
Consider keeping downloaded files as to not force too much traffic.

And then configure a few projects that will run on the defined geographical perimeter to run the process.  
It is not required to configure a whole project. Following lines of the `info.json` are particularly important:

```json
{
  "id": 3,
  "name": "2025-01_test",
  "title": "Test project",
  "start_date": "2024-10-01",
  "soft_end_date": "2025-12-31",
  "summary": "Test project",
  "links": {
    "osmwiki": "https://wiki.openstreetmap.org/wiki/Power_networks",
    "osmblog": "https://mapyourgrid.org"
  },
  "database": {
    "osmium_tag_filter": "w/power=line,cable&voltage",
    "imposm": {
            "types": ["linestring"],
            "mapping": { "power": ["line", "cable"], "voltage": true }
    }
  },
  "datasources": [
    {
      "source": "osm",
      "name": "Power line segments existing in OSM",
      "description": "This line segment already exists in OSM. Feel free to complete any missing property."
    },
    { "source": "stats" }
  ],
  "statistics": {
    "count": true,
    "feature_name": "segments",
    "points": { "add": 3, "edit": 2, "delete": 1 }
  },
  "editors": {
    "pdm": false,
    "all": {
      "comment": "Integrate power lines in OSM",
      "hashtags": "mapyourgrid"
    }
  },
  "opendata": [
    { "title": "Worldwide map of power infrastructure in OpenStreetMap", "via": "OpenInfraMap", "url": "https://openinframap.org/#15/45.9120/6.1275" }
  ]
}
```

#### Preserve temporary files for investigation

You may face problems that requires to investigate intermediates files of the processing scripts.  
They are usually removed as to not overload storage but it's possible to build a docker image that prevent them to disappear.

During import, you can enable the `keep` mode by adding that word at the of the import docker command:

```bash
docker run --rm [--network=your-network] -v host_work_dir:container_work_dir -e DB_URL=postgres://user:password@host:5432/database pdm/server:latest update_changes init keep
```

### Propose your changes

Always provide logs of processing in any change proposal as to illustrate how processing time is impacted.  
You can provide access to functional instance of this software as an optional measure to show how your changes would impact of its functioning apect.

