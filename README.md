# kafka-node-docker-mysql-example
dockerized node, kafka, and mysql, mongodb api

## Kafka
Using `node-rdkafka` a wrapper for the c++ rdkafka library. Maintained by Blizzard https://github.com/Blizzard/node-rdkafka

## Running and Installation
run `docker-compose build` to build the npm images.
run `docker-compose up` to start and pull kafka and zookeeper images.
run `docker-compose down -v` to remove volumes and images.

## API
Products api using Apache Kafka to produce topics, to be consumed by the database.
sing apache kafka found here: http://kafka.apache.org/documentation.html#quickstart

Built from an exisiting assignment for Cloud development at Oregon State University.
