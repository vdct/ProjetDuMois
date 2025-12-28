# Podoma API

Podoma exposes an API that provides most of computed data to third party users. It is then possible to consume to feed dashboards or external tooling.

## Project endpoint

The project endpoint is intended to serve most data related to a given project.

### Stats

`/projects/:slug/stats`

This routes mainly serves each project dashboard on the Podoma's web interface. It compiles several information to be displayed online.

### Counts

`/projects/:slug/counts`

This route is about features counts, lengths and surfaces.

### Mappers

`/projects/:slug/mappers`

This route gives access to the amount of mappers involved in the project.