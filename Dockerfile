FROM node:24-trixie-slim

ENV DB_URL=postgres://localhost:5432/osm
ENV PORT=3000
ARG IMPOSM3_VERSION=0.11.0
ARG CONFIG=./config.json

SHELL ["/bin/bash", "-o", "pipefail", "-c"]
RUN groupadd --gid 10001 -r osm \
    && useradd --uid 10001 -d /home/osm -m -r -s /bin/false -g osm osm \
    && mkdir -p /data/files/pdm /opt/pdm /opt/imposm3 \
    && apt-get update \
    && apt-get -y install --no-install-recommends \
        apt-utils curl xsltproc osmctools ca-certificates gnupg \
    && apt-get -y --no-install-recommends install postgresql-client libpq-dev libgeos-dev osmium-tool python3 python3-requests bc \
    && apt-get clean \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/imposm3

RUN curl -L https://github.com/omniscale/imposm3/releases/download/v${IMPOSM3_VERSION}/imposm-${IMPOSM3_VERSION}-linux-x86-64.tar.gz -o imposm3.tar.gz \
    && tar -xvf imposm3.tar.gz --strip 1 \
    && rm -f imposm3.tar.gz \
    && chmod a+x ./imposm \
    && cp ./imposm /usr/local/bin/ \
    && cp ./lib/* /usr/lib/

WORKDIR /opt/pdm

COPY --chown=osm:osm ./lib ./lib
RUN sed -i -e 's/allow_read_prefs": "yes"/allow_read_prefs": "1"/g' ./lib/sendfile_osm_oauth_protector/oauth_cookie_client.py

COPY --chown=osm:osm ./package.json ./package.json
RUN npm install

COPY --chown=osm:osm dockerfiles/docker-entrypoint.sh README.md ./
COPY --chown=osm:osm ./db/ ./db
COPY --chown=osm:osm ./website ./website
COPY --chown=osm:osm ./projects ./projects

RUN chmod +x ./docker-entrypoint.sh \
    && chown -R osm:osm /data/files/pdm \
    && chmod -R 755 /data/files/pdm

COPY --chown=osm:osm ${CONFIG} ./config.json

USER osm

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
