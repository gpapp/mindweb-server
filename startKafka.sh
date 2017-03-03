#!/bin/bash
source stopKafka.sh
docker run -d -p 2181:2181 -p9092:9092  --env ADVERTISED_HOST="localhost" --name service-kafka spotify/kafka:latest
docker logs -f service-kafka