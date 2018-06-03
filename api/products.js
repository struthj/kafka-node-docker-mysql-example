const router = require('express').Router();
const validation = require('../lib/validation');


/// Kafka Producer
var Kafka = require('node-rdkafka');
const KAFKA_BROKER_LIST = 'kafka:9092';

var stream = Kafka.Producer.createWriteStream({
  'metadata.broker.list': KAFKA_BROKER_LIST
}, {}, {
  topic: 'business'
});



stream.on('error', function (err) {
  // Here's where we'll know if something went wrong sending to Kafka
  console.log('Error in our kafka stream');
  console.log(err);
  if(!stream.producer.isConnected()){
      stream.producer.connect();
  }

});

// Attempt reconnect if disconnected 
stream.producer.on('disconnect', () => {
    if(!stream.producer.isConnected()){
      stream.producer.connect();
  }
})

// Disconnect is recieve termination signal
stream.producer.on('SIGTERM', () => {
     producer.disconnect();
 });


var producer = new Kafka.Producer({
    debug: 'all',
    'client.id': 'user-api',
    'metadata.broker.list': KAFKA_BROKER_LIST,
    'compression.codec': 'gzip',
    'retry.backoff.ms': 200,
    'message.send.max.retries': 10,
    'socket.keepalive.enable': true,
    'queue.buffering.max.messages': 100000,
    'queue.buffering.max.ms': 1000,
    'batch.num.messages': 1000000,
    dr_cb: true
  });


function sendMsg(topic, payload, partition){
  //console.log("HERERE");
  // Writes a message to the stream
  let str = JSON.stringify(payload).toString();
  var queuedSuccess = stream.write(new Buffer(str));
  stream.producer.poll();

  if (queuedSuccess) {
    console.log('We queued our message!');
  } else {
    // Note that this only tells us if the stream's queue is full,
    // it does NOT tell us if the message got to Kafka!  See below...
    console.log('Too many messages in our queue already');
    stream.producer.flush({}, () => {
      console.log("flushing queue");
    });
  }
}



/*
 * Schema describing required/optional fields of a business object.
 */
const businessSchema = {
  ownerid: { required: true },
  name: { required: true },
  address: { required: true },
  city: { required: true },
  state: { required: true },
  zip: { required: true },
  phone: { required: true },
  category: { required: true },
  subcategory: { required: true },
  website: { required: false },
  email: { required: false }
};

/*
 * Executes a MySQL query to fetch the total number of businesses.  Returns
 * a Promise that resolves to this count.
 */
function getBusinessesCount(mysqlPool) {
  return new Promise((resolve, reject) => {
    mysqlPool.query('SELECT COUNT(*) AS count FROM products', function (err, results) {
      if (err) {
        reject(err);
      } else {
        resolve(results[0].count);
      }
    });
  });
}

/*
 * Executes a MySQL query to return a single page of businesses.  Returns a
 * Promise that resolves to an array containing the fetched page of businesses.
 */
function getBusinessesPage(page, totalCount, mysqlPool) {
  return new Promise((resolve, reject) => {
    /*
     * Compute last page number and make sure page is within allowed bounds.
     * Compute offset into collection.
     */
    const numPerPage = 10;
    const lastPage = Math.max(Math.ceil(totalCount / numPerPage), 1);
    page = page < 1 ? 1 : page;
    page = page > lastPage ? lastPage : page;
    const offset = (page - 1) * numPerPage;

    mysqlPool.query(
      'SELECT * FROM products',
      [ offset, numPerPage ],
      function (err, results) {
        if (err) {
          reject(err);
        } else {
          resolve({
            businesses: results,
            pageNumber: page,
            totalPages: lastPage,
            pageSize: numPerPage,
            totalCount: totalCount
          });
        }
      }
    );
  });
}

/*
 * Route to return a paginated list of businesses.
 */
router.get('/', function (req, res) {
  const mysqlPool = req.app.locals.mysqlPool;
  getBusinessesCount(mysqlPool)
    .then((count) => {
      return getBusinessesPage(parseInt(req.query.page) || 1, count, mysqlPool);
    })
    .then((businessesPageInfo) => {

      sendMsg("business", businessesPageInfo, 0);

      businessesPageInfo.links = {};
      let { links, pageNumber, totalPages } = businessesPageInfo;
      if (pageNumber < totalPages) {
        links.nextPage = `/businesses?page=${pageNumber + 1}`;
        links.lastPage = `/businesses?page=${totalPages}`;
      }
      if (pageNumber > 1) {
        links.prevPage = `/businesses?page=${pageNumber - 1}`;
        links.firstPage = '/businesses?page=1';
      }
      res.status(200).json(businessesPageInfo);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({
        error: "Error fetching businesses list.  Please try again later."
      });
    });
});

/*
 * Executes a MySQL query to insert a new business into the database.  Returns
 * a Promise that resolves to the ID of the newly-created business entry.
 */
function insertNewBusiness(business, mysqlPool) {
  return new Promise((resolve, reject) => {
    business = validation.extractValidFields(business, businessSchema);
    business.id = null;
    mysqlPool.query(
      'INSERT INTO businesses SET ?',
      business,
      function (err, result) {
        if (err) {
          reject(err);
        } else {
          resolve(result.insertId);
        }
      }
    );
  });
}

/*
 * Route to create a new business.
 */
router.post('/', function (req, res, next) {
  const mysqlPool = req.app.locals.mysqlPool;
  if (validation.validateAgainstSchema(req.body, businessSchema)) {
    insertNewBusiness(req.body, mysqlPool)
      .then((id) => {
        res.status(201).json({
          id: id,
          links: {
            business: `/businesss/${id}`
          }
        });
      })
      .catch((err) => {
        res.status(500).json({
          error: "Error inserting business into DB.  Please try again later."
        });
      });
  } else {
    res.status(400).json({
      error: "Request body is not a valid business object."
    });
  }
});

/*
 * Executes a MySQL query to fetch information about a single specified
 * business based on its ID.  Returns a Promise that resolves to an object
 * containing information about the requested business.  If no business with
 * the specified ID exists, the returned Promise will resolve to null.
 */
function getBusinessByID(businessID, mysqlPool) {
  /*
   * Execute three sequential queries to get all of the info about the
   * specified business, including its reviews and photos.  If the original
   * request to fetch the business doesn't match a business, send null through
   * the promise chain.
   */
  let returnBusiness = {};
  return new Promise((resolve, reject) => {
    mysqlPool.query('SELECT * FROM businesses WHERE id = ?', [ businessID ], function (err, results) {
      if (err) {
        reject(err);
      } else {
        resolve(results[0]);
      }
    });
  }).then((business) => {
    if (business) {
      returnBusiness = business;
      return getReviewsByBusinessID(businessID, mysqlPool);
    } else {
      return Promise.resolve(null);
    }
  }).then((reviews) => {
    if (reviews) {
      returnBusiness.reviews = reviews;
      return getPhotosByBusinessID(businessID, mysqlPool);
    } else {
      return Promise.resolve(null);
    }
  }).then((photos) => {
    if (photos) {
      returnBusiness.photos = photos;
      return Promise.resolve(returnBusiness);
    } else {
      return Promise.resolve(null);
    }
  })
}

/*
 * Route to fetch info about a specific business.
 */
router.get('/:businessID', function (req, res, next) {
  const mysqlPool = req.app.locals.mysqlPool;
  const businessID = parseInt(req.params.businessID);
  getBusinessByID(businessID, mysqlPool)
    .then((business) => {
      if (business) {
        res.status(200).json(business);
      } else {
        next();
      }
    })
    .catch((err) => {
      res.status(500).json({
        error: "Unable to fetch business.  Please try again later."
      });
    });
});

/*
 * Executes a MySQL query to replace a specified business with new data.
 * Returns a Promise that resolves to true if the business specified by
 * `businessID` existed and was successfully updated or to false otherwise.
 */
function replaceBusinessByID(businessID, business, mysqlPool) {
  return new Promise((resolve, reject) => {
    business = validation.extractValidFields(business, businessSchema);
    mysqlPool.query('UPDATE businesses SET ? WHERE id = ?', [ business, businessID ], function (err, result) {
      if (err) {
        reject(err);
      } else {
        resolve(result.affectedRows > 0);
      }
    });
  });
}

/*
 * Route to replace data for a business.
 */
router.put('/:businessID', function (req, res, next) {
  const mysqlPool = req.app.locals.mysqlPool;
  const businessID = parseInt(req.params.businessID);
  if (validation.validateAgainstSchema(req.body, businessSchema)) {
    replaceBusinessByID(businessID, req.body, mysqlPool)
      .then((updateSuccessful) => {
        if (updateSuccessful) {
          res.status(200).json({
            links: {
              business: `/businesses/${businessID}`
            }
          });
        } else {
          next();
        }
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({
          error: "Unable to update specified business.  Please try again later."
        });
      });
  } else {
    res.status(400).json({
      error: "Request body is not a valid business object"
    });
  }
});

/*
 * Executes a MySQL query to delete a business specified by its ID.  Returns
 * a Promise that resolves to true if the business specified by `businessID`
 * existed and was successfully deleted or to false otherwise.
 */
function deleteBusinessByID(businessID, mysqlPool) {
  return new Promise((resolve, reject) => {
    mysqlPool.query('DELETE FROM businesses WHERE id = ?', [ businessID ], function (err, result) {
      if (err) {
        reject(err);
      } else {
        resolve(result.affectedRows > 0);
      }
    });
  });

}

/*
 * Route to delete a business.
 */
router.delete('/:businessID', function (req, res, next) {
  const mysqlPool = req.app.locals.mysqlPool;
  const businessID = parseInt(req.params.businessID);
  deleteBusinessByID(businessID, mysqlPool)
    .then((deleteSuccessful) => {
      if (deleteSuccessful) {
        res.status(204).end();
      } else {
        next();
      }
    })
    .catch((err) => {
      res.status(500).json({
        error: "Unable to delete business.  Please try again later."
      });
    });
});

/*
 * Executes a MySQL query to fetch all businesses owned by a specified user,
 * based on on the user's ID.  Returns a Promise that resolves to an array
 * containing the requested businesses.  This array could be empty if the
 * specified user does not own any businesses.  This function does not verify
 * that the specified user ID corresponds to a valid user.
 */
function getBusinessesByOwnerID(userID, mysqlPool) {
  return new Promise((resolve, reject) => {
    mysqlPool.query(
      'SELECT * FROM businesses WHERE ownerid = ?',
      [ userID ],
      function (err, results) {
        if (err) {
          reject(err);
        } else {
          resolve(results);
        }
      }
    );
  });
}

exports.router = router;
exports.getBusinessesByOwnerID = getBusinessesByOwnerID;
