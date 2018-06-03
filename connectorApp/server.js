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
var messages = 15;

// Mongodb config
const mongoHost = process.env.MONGO_HOST;
const mongoPort = process.env.MONGO_PORT || '27017';
const mongoDBName = process.env.MONGO_INITDB_DATABASE;
const mongoUser = process.env.MONGO_INITDB_ROOT_USERNAME;
const mongoPassword = process.env.MONGO_INITDB_ROOT_PASSWORD;

const mongoURL = `mongodb://${mongoUser}:${mongoPassword}@${mongoHost}:${mongoPort}/?authSource=admin`
console.log("== Mongo URL:", mongoURL);


/// Initialize MongoDB

var connectWithRetry = function() {

  return MongoClient.connect(mongoURL, (err, client) => {
    if (!err) {
      var col = client.db("products");
      col.collection("ilikecheese").insert({cheese: "cheese"});
      app.locals.mongoDB = client.db(mongoDBName);
        console.log("== Server is running on port", port);

    } else {
      console.log("== Server error ", err);
      setTimeout(connectWithRetry, 1000);
    }
  });
}

 // Create Kafka Consumer stream
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

// Create stream and connect to kafka
Cstream = createStream();

app.use(morgan('dev'));

app.use(bodyParser.json());
app.use(express.static('public'));

app.use('*', function (req, res, next) {
  res.status(404).json({
    error: "Requested resource " + req.originalUrl + " does not exist"
  });
});

// Landing page
app.get("/", (req,res,next) => {
    res.json("Welcome to the connectDb");
});


app.listen(port,() => {
    console.log("== Server is running on port", port);

    // Connect to MongoDB
    connectWithRetry();

    //Set timeout to attempt conencting to kafka
    setTimeout(() => {
// Cstream
//   .pipe(process.stdout);
    },3000);

    //Event listener for recieving data error
    Cstream.on('error', function(err) {
        console.log(err);
        if(!Cstream.consumer.isConnected()){
            Cstream.consumer.connect();
        }
    });

    // Access consumer and add event listener for error event
    Cstream.consumer.on('event.error', function(err) {
        console.log(err);
        if(!Cstream.consumer.isConnected()){
            Cstream.consumer.connect();
        }
    });

    // Event listener for disconnect
    Cstream.consumer.on('disconnect', () => {
        console.log("Disconnected");
        if(!Cstream.consumer.isConnected()){
            Cstream.consumer.connect();
        }
    })

    // Event listener for data ready
     Cstream.consumer.on('data', (message) => {
        if(messages > 0){
            messages--;
        } else {
            // Commit offset if "buffer" full
            Cstream.consumer.commit();
            messages = 15;
        }
        console.log("recieving message.");
        console.log(message.value.toString());
    });
    
});
