# Podoma API

Podoma exposes an API that provides most of computed data to third party users. It is then possible to consume to feed dashboards or external tooling.

## Project endpoint

The project endpoint is intended to serve most data related to a given project.

### Stats

`/projects/:slug/stats`

This routes mainly serves each project dashboard on the Podoma's web interface. It compiles several information to be displayed online.

### Counts

This route is about features counts, lengths and surfaces.

`/projects/:slug/counts`
`/projects/:slug/counts/boundary/:boundary`

### Contribution

These routes let access to contribution counts, i.e delta for each counted date.

`projects/:slug/contrib`
`projects/:slug/contrib/team/:team`
`projects/:slug/contrib/mapper/:user`

### Mappers

These routes give access to the amount of mappers involved in the project.

`/projects/:slug/mappers`
`/projects/:slug/mappers/boundary/:boundary`
