#!/bin/bash

command=${1}

if [ -z $DB_URL ]; then
    echo "Required env variable DB_URL should be set to reach pgsql backend"
    exit 1
fi

echo "Executing ${command} command"

case $command in
"install")
    psql -d $DB_URL -f ./db/00_init.sql
    ;;
"init")
    npm run feature:update
    ./db/21_features_update_tmp.sh
    ;;
"run")
    npm run project:update
    npm run start
    ;;
*)
    echo "Command $command unknown"
    exit 2
    ;;
esac