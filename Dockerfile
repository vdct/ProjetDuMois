FROM node:14.18.0-bullseye-slim

RUN groupadd --gid 10001 -r osm \
    && useradd --uid 10001 -d /home/osm -m -r -s /bin/false -g osm osm \
    && mkdir -p /data/files/pdm /opt/pdm /opt/imposm3 \
    && apt-get update \
    && apt-get -y install --no-install-recommends \
        apt-utils curl xsltproc osmctools ca-certificates gnupg \
    && curl https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add - \
    && echo "deb http://apt.postgresql.org/pub/repos/apt bullseye-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update \
    && apt-get -y --no-install-recommends install postgresql-client-13 libpq-dev libgeos-dev osmium-tool python3 python3-requests \
    && apt-get clean \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ARG IMPOSM3_VERSION=0.11.0

WORKDIR /opt/imposm3

RUN curl -L https://github.com/omniscale/imposm3/releases/download/v${IMPOSM3_VERSION}/imposm-${IMPOSM3_VERSION}-linux-x86-64.tar.gz -o imposm3.tar.gz \
    && tar -xvf imposm3.tar.gz --strip 1 \
    && rm -f imposm3.tar.gz

WORKDIR /opt/pdm

COPY --chown=osm:osm ./db/ ./db
COPY --chown=osm:osm ./projects ./projects
COPY --chown=osm:osm ./website ./website
COPY --chown=osm:osm ./lib ./lib
COPY --chown=osm:osm ./config.json ./config.json
COPY --chown=osm:osm ./package.json ./package.json

RUN npm install

COPY --chown=osm:osm dockerfiles/docker-entrypoint.sh README.md ./

RUN chmod +x ./docker-entrypoint.sh \
    && chown -R osm:osm /data/files/pdm \
    && chmod -R 755 /data/files/pdm

USER osm

ENV DB_URL=postgres://localhost:5432/osm
ENV PORT=3000

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]