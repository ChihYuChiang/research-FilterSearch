/*
------------------------------------------------------------
Set-up
------------------------------------------------------------
*/
//--Base
//'underscore' provides misc utility functions
//https://underscorejs.org/
const fs = require('fs');
const child_process = require('child_process');
const _ = require('underscore');


//--Config
//Config file contain the Google API key pair
//SEARCH_MODE == 'term' perform only term reverse and no Google search
//SEARCH_MODE == 'scrape' or 'api' perform corresponding Google search implementation
//SERVER_OS == 'linux', change command to python3, \n instead of \r\n 
const CONFIG = JSON.parse(fs.readFileSync(__dirname + '/config.json'));
const SEARCH_MODE = process.argv[2] ? process.argv[2] : 'api';
const O_MULTIPLIER = process.argv[4] ? process.argv[4] : 2; //For sorting result
const PORT_LISTENED = SEARCH_MODE == 'term' ? 3001 : 3000;
var SERVER_OS = process.argv[3] ? process.argv[3] : 'windows';
var PRINT_SEARCH = true;


//--Server
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
if(app.get('env') == 'production') { //Production mode
  SERVER_OS = 'linux';
  PRINT_SEARCH = false;
}


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

//Logger contents and outputs
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
//--Reverse search term
function termProcessing(searchTerm, responseId) {
  //Adjust by os
  const CMD = SERVER_OS == 'linux' ? 'python3' : 'python';
  const LINE_BREAK = SERVER_OS == 'linux' ? '\n' : '\r\n';

  //A promise for term processing
  return new Promise((resolve, reject) => {
    let processing = child_process.spawn(CMD, ['sub_termProcessing.py', searchTerm]);
    
    //Listen to stdout of the child process to receive processed result
    let dataStream = '';
    processing.stdout.on('data', (data) => {
      dataStream += data.toString();
    });
    processing.stdout.on('end', () => {
      //Process the return string
      output = dataStream.trim().split(LINE_BREAK)

      //Log
      logger.log({
        level: 'info',
        message: 'Perform term processing successfully.',
        searchTerm: searchTerm,
        searchTerm_reverse: output,
        responseId: responseId
      });
      
      //Resolve promise
      resolve(output);
    });
  });
}


//--Perform search of each term in the processed term set
function search(searchTerms, implement, res, responseId) {
  //Each search as a promise; wait for all resolved
  Promise
  .all(_.map(searchTerms, (searchTerm) => { return implement(searchTerm, responseId); }))

  //Process result and render
  .then((result) => {
    let searchResult = {};
    searchResult.searchTerms = searchTerms;
    searchResult.items = resultProcessing(result);
    
    if(PRINT_SEARCH) { console.log(searchResult); }

    rend(res, responseId, searchResult);
  });
}


//--Perform search of a single term by official Google api
async function search_api(searchTerm, responseId) {
  const res = await customsearch.cse.list({
    cx: CONFIG.CUSTOM_ENGINE_ID,
    auth: CONFIG.API_KEY,
    q: searchTerm
  });
  
  //Log
  logger.log({
    level: 'info',
    message: 'Perform api search successfully.',
    searchTerm: searchTerm,
    responseId: responseId
  });
  
  //Return a promise (due to async func)
  return res.data;
}


//--Perform search of a single term by scraping
function search_scrape(searchTerm, responseId) {
  return new Promise((resolve, reject) => {
    let search = child_process.spawn('python', ['sub_search.py', searchTerm]);
    
    //Listen to stdout of the child process to receive processed result
    let dataStream = '';
    search.stdout.on('data', (data) => {
      dataStream += data.toString();
    });
    search.stdout.on('end', () => {
      //Log
      logger.log({
        level: 'info',
        message: 'Perform scrape search successfully.',
        searchTerm: searchTerm,
        responseId: responseId
      });
      
      //Resolve promise
      resolve(JSON.parse(dataStream));
    });
  });
}


//--Process search results
function resultProcessing(result, responseId) {
  //Prepare output as an array
  let output = new Array();

  //Compute point and acquire necessary info of each item
  class ProcessedItem {
    constructor(item, origin, oidx) {
      //Inherit from raw result format
      this.title = item.title;
      this.link = item.link;
      this.snippet = item.snippet;

      //Id of the original query (0 = original search term)
      this.origin = [origin];

      //Points based on its rank in the response
      //Result from the original query is multiplied by O_MULTIPLIER
      this.point = origin == 0 ? (O_MULTIPLIER * (10 - oidx)) : (10 - oidx);
    }

    //Check if the item is already in the output, based on the item url (link)
    //Return: the id of the duplicate item in the output, or null if not found
    existent() {
      for(var i = 0; i < output.length; i++) {
        //Return the id when first duplicate is found 
        if(output[i].link == this.link) { return i; }
      }

      //If not found, return null
      return null;
    }
  }

  result.forEach((response, idx_r) => {
    response.items.forEach((item, idx_i) => {
      processedItem = new ProcessedItem(item, idx_r, idx_i);

      existenceMarker = processedItem.existent();

      //If exists, combined with the existent item in the output
      if(existenceMarker != null) {
        output[existenceMarker].origin.push(processedItem.origin[0]);
        output[existenceMarker].point += processedItem.point;

      //If is new, add as a new item in the output
      } else { output.push(processedItem); }
    });
  });

  //Sort the output based on item points
  output.sort((a, b) => {
    if (a.point < b.point) { return 1; }
    if (a.point > b.point) { return -1; }
    return 0;
  })

  //Log
  logger.log({
    level: 'info',
    message: 'Perform result processing successfully.',
    responseId: responseId
  });

  //Return the first 10 items in the sorted output
  return output.slice(0, 10);
}


//--Render page with vars passed to the client
function rend(req, res) {
  res.render('index', {
    error: null,
    responseId: req.params.responseId,
    searchTerms: res.locals.searchTerms ? res.locals.searchTerms : null,
    searchResult: res.locals.searchResult ? res.locals.searchResult : null
  });
}


//--Utility func for text processing
function sprintf(format) {
  for(var i = 1; i < arguments.length; i++) {
    format = format.replace(/%s/, arguments[i]);
  }
  return format;
}




/*
------------------------------------------------------------
Server Operation

- responseId is passed from Qualtrics, unique for each respondent
------------------------------------------------------------
*/
//--Get
app.get('/:responseId', (req, res, next) => {
  //Log
  logger.log({
    level: 'info',
    message: 'Client connected.',
    sourceIp: req.ip,
    responseId: req.params.responseId
  });
  
  //Render
  next();
}, rend);


//--Post
app.post('/:responseId', [post_surveyMode, post_termProcessing, post_reverseSearch, post_simpleSearch]);

function post_surveyMode(req, res, next) {
  //If the last character in 0-9, reverse search, else simple search
  res.locals.survey = req.params.responseId.match(/[0-9]$/) != null ? 'reverse' : 'simple';

  next();
}

function post_termProcessing(req, res, next) {
  //Acquire entered search term
  var searchTerm = req.body.search;
  var searchTerm_reverse = '';
  res.locals.searchTerms = [];
  
  //Term reversing
  var processing = termProcessing(searchTerm, req.params.responseId);
  processing.then((result) => {
    searchTerm_reverse = result;
    res.locals.searchTerms = [searchTerm].concat(searchTerm_reverse);

    //If search mode is 'term', render, else proceed
    if(SEARCH_MODE == 'term') {
      rend(req, res);
    } else { next(); }
  });
}

function post_reverseSearch(req, res, next) {
    //The search method to use
    var implement = SEARCH_MODE == 'scrape' ? search_scrape : search_api;

    //Each search as a promise; wait for all resolved
    Promise
    .all(_.map(res.locals.searchTerms, (searchTerm) => { return implement(searchTerm, req.params.responseId); }))
  
    //Process result and render
    .then((result) => {
      res.locals.searchResult_original = result[0].items.slice(0, 10);
      res.locals.searchResult = resultProcessing(result, req.params.responseId);
      
      //Print processed search result
      if(PRINT_SEARCH) { console.log(res.locals.searchResult); }
      
      //If survey mode is 'reverse', render, else proceed
      if(res.locals.survey == 'reverse') {
        rend(req, res);
      } else { next(); }
    });
}

function post_simpleSearch(req, res) {
  res.locals.searchResult = res.locals.searchResult_original;
  rend(req, res);
}


//--Start server
//Command: NODE_ENV=production node server.js [SEARCH_MODE, [SERVER_OS, [O_MULTIPLIER]]]
app.listen(PORT_LISTENED, () => {
  logger.info(sprintf('Server listening on port %s..', PORT_LISTENED));
});




/*
------------------------------------------------------------
Error handler

- https://expressjs.com/en/guide/error-handling.html
------------------------------------------------------------
*/
app.use(errorHandler);

function errorHandler (err, req, res, next) {
  //Log error
  logger.error(err.stack);

  //Response
  res.status(500);
  res.send('Process  failed. Please report the failure to administrator.');
}
