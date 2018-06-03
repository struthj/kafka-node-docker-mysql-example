const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const MongoClient = require('mongodb').MongoClient;

//const api = require('./api');

const app = express();
const port = process.env.PORT || 8001;
var Kafka = require('node-rdkafka');
const KAFKA_BROKER_LIST = 'kafka:9092';
var Cstream = {};



function createStream(){
    return Kafka.KafkaConsumer.createReadStream({
  'metadata.broker.list': KAFKA_BROKER_LIST,
  'group.id': 'librd-test',
  'socket.keepalive.enable': true,
  'enable.auto.commit': false
}, {}, {
  topics: 'business',
  waitInterval: 0,
  objectMode: false
});
}


app.use(morgan('dev'));

app.use(bodyParser.json());
app.use(express.static('public'));

app.use('*', function (req, res, next) {
  res.status(404).json({
    error: "Requested resource " + req.originalUrl + " does not exist"
  });
});


app.get("/", (req,res,next) => {
    res.status(200).json("Welcome to the connectDb");
});


app.listen(port,() => {
console.log("== Server is running on port", port);

    setTimeout(() => {
    Cstream = createStream();
    Cstream.on('error', function(err) {
  if (err) console.log(err);
  process.exit(1);
});
Cstream.consumer.on('data', (message) => {
    console.log("recieving message.");
    console.log(message.value.toString());
});

Cstream.on('error', function(err) {
  console.log(err);
  process.exit(1);
});

Cstream.consumer.on('event.error', function(err) {
  console.log(err);
})

// Cstream
//   .pipe(process.stdout);


},3000);
    
});
