#!/bin/bash
docker run -d -p 9042:9042  --env ADVERTISED_HOST="localhost" --name service-cassandra cassandra:latest
docker logs -f service-cassandra