#!/bin/bash

docker-compose down
./minifab cleanup
docker volume prune
rm -Rf vars
