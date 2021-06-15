FROM alpine:3

# Software versions + environment variables
ENV CPUS 4
ENV OSMIUM_VERSION 2.16.0
ENV OSMIUM_TOOL_VERSION 1.13.1
ENV PROTOZERO_VERSION 1.7.0


#
# Install and compile dependencies
#

# Install packaged dependencies
RUN apk add --update-cache curl nodejs npm python3 grep sed bc py3-requests libxslt gcc g++ cmake make wget tar expat-dev bzip2-dev expat zlib-dev libbz2 boost-dev  bash postgresql-client go git geos-dev leveldb-dev

RUN mkdir /work
WORKDIR /work

# Protozero (for Osmium)
RUN wget https://github.com/mapbox/protozero/archive/v${PROTOZERO_VERSION}.tar.gz && \
	tar xzvf v${PROTOZERO_VERSION}.tar.gz && \
	rm v${PROTOZERO_VERSION}.tar.gz && \
	mv protozero-${PROTOZERO_VERSION} protozero

RUN cd protozero && \
	mkdir build && cd build && \
	cmake .. && \
	echo "Building Protozero ${PROTOZERO_VERSION}..." && \
	make --quiet -j${CPUS} && make --quiet install

# Libosmium (for Osmium)
RUN wget https://github.com/osmcode/libosmium/archive/v${OSMIUM_VERSION}.tar.gz && \
	tar xzvf v${OSMIUM_VERSION}.tar.gz && \
	rm v${OSMIUM_VERSION}.tar.gz && \
	mv libosmium-${OSMIUM_VERSION} libosmium

RUN cd libosmium && \
	mkdir build && cd build && \
	cmake -DCMAKE_BUILD_TYPE=Release -DBUILD_EXAMPLES=OFF -DBUILD_TESTING=OFF .. && \
	echo "Building LibOsmium ${OSMIUM_VERSION}..." && \
	make --quiet -j${CPUS} && make --quiet install

# Osmium
RUN wget https://github.com/osmcode/osmium-tool/archive/v${OSMIUM_TOOL_VERSION}.tar.gz && \
	tar xzvf v${OSMIUM_TOOL_VERSION}.tar.gz && \
	rm v${OSMIUM_TOOL_VERSION}.tar.gz && \
	mv osmium-tool-${OSMIUM_TOOL_VERSION} osmium-tool

RUN cd osmium-tool && \
	mkdir build && cd build && \
	cmake .. && \
	echo "Building Osmium Tool ${OSMIUM_TOOL_VERSION}..." && \
	make --quiet -j${CPUS} && make --quiet install

# Osmctools
RUN wget -O - http://m.m.i24.cc/osmupdate.c | cc -x c - -o osmupdate && \
	mv osmupdate /usr/bin/
RUN wget -O - http://m.m.i24.cc/osmconvert.c | cc -x c - -lz -O3 -o osmconvert && \
	mv osmconvert /usr/bin/

# Imposm
RUN mkdir -p go && \
	cd go && \
	export GOPATH=`pwd` && \
	go get github.com/omniscale/imposm3 && \
	go install github.com/omniscale/imposm3/cmd/imposm

RUN cp go/bin/imposm /usr/bin/

# Clean-up
RUN rm -rf /work


#
# Init PdM directory
#

# Add ProjetDuMois content
RUN mkdir -p /pdm /conf /data
COPY ./ /pdm/

# Install NodeJS dependencies
WORKDIR /pdm
RUN npm install

# Link to user config
RUN ln -s /conf/config.json /pdm/
RUN ln -s /conf/projects /pdm/projects
