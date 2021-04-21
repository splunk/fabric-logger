#!/bin/bash

mkdir -p vars
curl -o minifab -sL https://tinyurl.com/yxa2q6yr && chmod +x minifab
./minifab up --fabric-release 2.2
set -o allexport
source vars/run/peer1.org0.example.com.env
set +o allexport
docker-compose up -d
