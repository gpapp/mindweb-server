#!/bin/bash
## This snippet is used by the build script to create container specific to the project
docker create \
    -P -p 0.0.0.0:$SERVER_PORT:8081 \
    --env TYPE=${TYPE} \
    --env DB_PORT=${DB_PORT} \
    --env HTTP_PORT=${HTTP_PORT} \
    --env SERVER_PORT=${SERVER_PORT} \
    --volume `pwd`/../.config/$TYPE/server/config:/home/node/config \
    --name mw-server-$TYPE \
    mindweb/server

if [ ! -f  ../.config/$TYPE/server/config/config.json ]; then 
  mkdir -p ../.config/$TYPE/server/config
  cp config/config.json ../.config/$TYPE/server/config/config.json
fi
