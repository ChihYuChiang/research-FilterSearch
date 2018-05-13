/*
------------------------------------------------------------
Set-up
------------------------------------------------------------
*/

//--Base
const fs = require('fs');
const child_process = require('child_process');


//--Config
const config = JSON.parse(fs.readFileSync(__dirname + '/config.json'));
process.argv[2];


//--Server
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));


//--Google search official api
//https://console.developers.google.com/apis/credentials
//https://developers.google.com/custom-search/json-api/v1/overview
//https://developers.google.com/custom-search/json-api/v1/reference/cse/list#request
const { google } = require('googleapis');
const customsearch = google.customsearch('v1');


//--Logger
//https://github.com/winstonjs/winston
const { createLogger, format, transports } = require('winston');
const logger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.File({ filename: './log/app.log' }),
    new transports.Console({ format: format.simple()})
  ]
})




/*
------------------------------------------------------------
Function
------------------------------------------------------------
*/
async function search_api(searchTerm) {
  const res = await customsearch.cse.list({
    cx: config.CUSTOM_ENGINE_ID,
    auth: config.API_KEY,
    q: searchTerm
  });

  return res.data;
}

function search(searchTerms, res, rend) {
  Promise
  .all([search_api(searchTerms[0]), search_api(searchTerms[1])])
  .then((result) => {
    let searchResult = {};
    searchResult.searchTerms = searchTerms;
    searchResult.items = result[0].items.slice(0, 5).concat(result[1].items.slice(0, 5));
    console.log(searchResult);

    rend(res, searchResult);
  });
}

function search_scrape(searchTerm, res, rend) {
  let search = child_process.spawn('python', ['sub_search.py', searchTerm]);

  let dataStream = '';
  search.stdout.on('data', (data) => {
    dataStream += data.toString();
  });
  search.stdout.on('end', () => {
    const searchResult = JSON.parse(dataStream);
    console.log(searchResult);

    rend(res, searchResult);
  });
}

function rend(res, searchResult) {
  res.render('index', {
    error: null,
    searchTerms: searchResult ? searchResult['searchTerms'] : null,
    data: searchResult ? searchResult['items'] : null
  });
}

function termProcessing(searchTerm) {
  return new Promise((resolve, reject) => {
    let processing = child_process.spawn('python', ['sub_termProcessing.py', searchTerm]);

    let dataStream = '';
    processing.stdout.on('data', (data) => {
      dataStream += data.toString();
    });
    processing.stdout.on('end', () => {
      resolve(dataStream);
    });
  });
}




/*
------------------------------------------------------------
Server Operation
------------------------------------------------------------
*/
app.get(['/', /\/.+/], function (req, res) {
  logger.log({
    level: 'info',
    message: 'Client connected.',
    sourceIp: req.ip,
    sourcePath: req.path
  });

  rend(res, null);
});

app.post(['/', /\/.+/], function (req, res) {
  var searchTerm = req.body.search;
  var searchTerm_reverse = '';
  var searchTerms = [];
  // search_scrape(searchTerm, res, rend);

  var processing = termProcessing(searchTerm);
  processing.then((result) => {
    searchTerm_reverse = result;
    searchTerms = [searchTerm, searchTerm_reverse];

    search(searchTerms, res, rend);
  })
});

app.listen(3000, function () {
  logger.info('Server listening on port 3000..');
});