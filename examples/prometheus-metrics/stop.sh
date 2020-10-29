#!/bin/bash

docker-compose down
./minifab down
docker volume prune
rm -Rf vars
