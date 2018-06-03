const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const MongoClient = require('mongodb').MongoClient;

const api = require('./api');

const app = express();
const port = process.env.PORT || 8000;


// MYSQL conns
const mysqlHost = process.env.MYSQL_HOST;
const mysqlPort = process.env.MYSQL_PORT || '3306';
const mysqlDBName = process.env.MYSQL_DATABASE;
const mysqlUser = process.env.MYSQL_USER;
const mysqlPassword = process.env.MYSQL_PASSWORD;

const maxMySQLConnections = 10;
app.locals.mysqlPool = mysql.createPool({
  connectionLimit: maxMySQLConnections,
  host: mysqlHost,
  port: mysqlPort,
  database: mysqlDBName,
  user: mysqlUser,
  password: mysqlPassword
});

// Mongodb conns
const mongoHost = process.env.MONGO_HOST;
const mongoPort = process.env.MONGO_PORT || '27017';
const mongoDBName = process.env.MONGO_INITDB_DATABASE;
const mongoUser = process.env.MONGO_INITDB_ROOT_USERNAME;
const mongoPassword = process.env.MONGO_INITDB_ROOT_PASSWORD;

const mongoURL = `mongodb://${mongoUser}:${mongoPassword}@${mongoHost}:${mongoPort}/?authSource=admin`
console.log("== Mongo URL:", mongoURL);
/*
 * Morgan is a popular logger.
 */
app.use(morgan('dev'));

app.use(bodyParser.json());
app.use(express.static('public'));

/*
 * All routes for the API are written in modules in the api/ directory.  The
 * top-level router lives in api/index.js.  That's what we include here, and
 * it provides all of the routes.
 */
app.use('/', api);

app.use('*', function (req, res, next) {
  res.status(404).json({
    error: "Requested resource " + req.originalUrl + " does not exist"
  });
});

const url = 'mongodb://mongo/dummy-app'
var connectWithRetry = function() {

  return MongoClient.connect(mongoURL, (err, client) => {
    if (!err) {
      app.locals.mongoDB = client.db(mongoDBName);
      app.locals.mongoDB.collection("users").insert({user: { username: "cheese", 
                                              email: "my@email.com",
                                              pass: "1234"}
                                    });
      app.listen(port,() => {
        console.log("== Server is running on port", port);

      });
    } else {
      console.log("== Server error ", err);
      setTimeout(connectWithRetry, 1000);
    }
  });
}

connectWithRetry();