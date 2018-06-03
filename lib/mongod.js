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

var connectWithRetry = function() {

  return MongoClient.connect(mongoURL, (err, client) => {
    if (!err) {
      var col = client.db("users");
      col.collection("ilikecheese").insert({cheese: "cheese"});
      app.locals.mongoDB = client.db(mongoDBName);
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