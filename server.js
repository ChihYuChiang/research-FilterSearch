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
const SEARCH_MODE = process.argv[2] ? process.argv[2] : 'api';


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

//Filter the connection produced by dns rerouting
const filter_favicon = format((info, opts) => {
  if (info.sourcePath == '/favicon.ico') { return false; }
  return info;
});
const logger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.json(),
    filter_favicon()
  ),
  transports: [
    new transports.File({ filename: './log/app.log' }),
    new transports.Console({ format: format.simple()})
  ]
});




/*
------------------------------------------------------------
Function
------------------------------------------------------------
*/
function rend(res, searchResult) {
  res.render('index', {
    error: null,
    searchTerms: searchResult['searchTerms'] ? searchResult['searchTerms'] : null,
    data: searchResult['items'] ? searchResult['items'] : null
  });
}

function search(searchTerms, implement, res, rend) {
  Promise
  .all([implement(searchTerms[0]), implement(searchTerms[1])])
  .then((result) => {
    let searchResult = {};
    searchResult.searchTerms = searchTerms;
    searchResult.items = result[0].items.slice(0, 5).concat(result[1].items.slice(0, 5));
    console.log(searchResult);
    
    rend(res, searchResult);
  });
}

async function search_api(searchTerm) {
  const res = await customsearch.cse.list({
    cx: config.CUSTOM_ENGINE_ID,
    auth: config.API_KEY,
    q: searchTerm
  });

  logger.log({
    level: 'info',
    message: 'Perform api search successfully.',
    searchTerm: searchTerm
  });

  return res.data;
}

function search_scrape(searchTerm) {
  return new Promise((resolve, reject) => {
    let search = child_process.spawn('python', ['sub_search.py', searchTerm]);

    let dataStream = '';
    search.stdout.on('data', (data) => {
      dataStream += data.toString();
    });
    search.stdout.on('end', () => {
      logger.log({
        level: 'info',
        message: 'Perform scrape search successfully.',
        searchTerm: searchTerm
      });

      resolve(JSON.parse(dataStream));
    });
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
      logger.log({
        level: 'info',
        message: 'Perform term processing successfully.',
        searchTerm: searchTerm,
        searchTerm_reverse: dataStream
      });

      resolve(dataStream);
    });
  });
}




/*
------------------------------------------------------------
Server Operation
------------------------------------------------------------
*/
app.get(['/', /\/.+/], (req, res) => {
  logger.log({
    level: 'info',
    message: 'Client connected.',
    sourceIp: req.ip,
    sourcePath: req.path
  });

  rend(res, { searchTerms: null, searchResult: null });
});

app.post(['/', /\/.+/], (req, res) => {
  var searchTerm = req.body.search;
  var searchTerm_reverse = '';
  var searchTerms = [];

  var processing = termProcessing(searchTerm);
  processing.then((result) => {
    searchTerm_reverse = result;
    searchTerms = [searchTerm, searchTerm_reverse];

    //SEARCH_MODE == 'term' perform only term reverse and no Google search
    //SEARCH_MODE == 'scrape' or 'api' perform corresponding Google search implementation
    if(SEARCH_MODE == 'term') {
      rend(res, { searchTerms: searchTerms, searchResult: null });
    } else {
      search(searchTerms, SEARCH_MODE == 'scrape' ? search_scrape : search_api, res, rend);
    }
  });
});

app.listen(3000, () => {
  logger.info('Server listening on port 3000..');
});