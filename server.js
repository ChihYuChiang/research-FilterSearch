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
//SEARCH_MODE == 'scrape' or 'api' perform corresponding Google search implementation
//SERVER_OS == 'linux', change command to python3, \n instead of \r\n 
const CONFIG = JSON.parse(fs.readFileSync(__dirname + '/config.json'));
const O_MULTIPLIER = process.argv[2] ? process.argv[2] : 1.25; //For sorting result
const SEARCH_MODE = 'api';
var SERVER_OS = 'windows';
var CMD = 'python';
var PORT_LISTENED = 3000;
var LINE_BREAK = '\r\n';
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
  CMD = 'python3';
  PORT_LISTENED = 80;
  LINE_BREAK = '\n';
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
  level: 'verbose',
  format: format.combine(
    format.timestamp(),
    format.json(),
    filter_favicon()
  ),
  transports: [
    //Break line with \r\n to make visually available in windows
    new transports.File({ filename: './log/app.log', eol: '\r\n' }),
    new transports.Console({ format: format.simple() })
  ]
});




/*
------------------------------------------------------------
Function
------------------------------------------------------------
*/
//--Reverse search term
function termProcessing(searchTerm, responseId) {
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
        level: 'verbose',
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


//--Perform search of a single term by official Google api
async function search_api(searchTerm, responseId) {
  const res = await customsearch.cse.list({
    cx: CONFIG.CUSTOM_ENGINE_ID,
    auth: CONFIG.API_KEY,
    q: searchTerm
  });
  
  //Log
  logger.log({
    level: 'verbose',
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
        level: 'verbose',
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
    level: 'verbose',
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
    surveyMode: res.locals.survey,
    searchTerms: res.locals.searchTerms,
    searchResult: res.locals.searchResult
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

- responseId is passed from Qualtrics, unique for each respondent.
- The case scenarios bases on document in /data.
------------------------------------------------------------
*/
//--Get
//Main page
app.get(['/search/:responseId(term)', '/search/:responseId(*{0,}[0-6])'], (req, res, next) => {
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

//Record unload event
app.get('/unload/:responseId', (req, res) => {
  logger.log({
    level: 'info',
    message: 'Client unloaded.',
    responseId: req.params.responseId
  });
});

//Record mouse click event
app.get('/link-clicked/:responseId/:idx/:origin', (req, res) => {
  logger.log({
    level: 'info',
    message: 'User clicked link.',
    responseId: req.params.responseId,
    idx: req.params.idx,
    origin: req.params.origin
  });
});


//--Post
//Term reverse only
app.post('/search/:responseId(term)', (req, res, next) => {
  res.locals.searchTerms = [req.body.search]; next();
}, [post_termProcessing, rend]);

//Simple search only
app.post('/search/:responseId(*{0,}[0-3])', [post_surveyMode, post_search, rend]);

//Reverse search
app.post('/search/:responseId(*{0,}[4-6])', [post_surveyMode, post_termProcessing, post_search, rend]);

//Handler functions
function post_surveyMode(req, res, next) {
  //Record the typed-in search term
  logger.log({
    level: 'info',
    message: 'Client performed search.',
    responseId: req.params.responseId,
    typedInTerm: req.body.search
  });

  //Survey mode based on responseId last digit
  res.locals.survey = parseInt(req.params.responseId[req.params.responseId.length - 1]);

  //Root search term based on survey mode
  switch(res.locals.survey) {
    case 0:
      res.locals.searchTerms = [req.body.search]; break;
    case 1: 
      res.locals.searchTerms = ['caffeine health risks and benefits']; break;
    case 2:
      res.locals.searchTerms = ['caffeine health risks']; break;
    case 3:
      res.locals.searchTerms = ['caffeine health benefits']; break;
    case 4:
    case 5:
    case 6:
      res.locals.searchTerms = [req.body.search, 'caffeine health risks and benefits'];
  }

  //Print the root search terms
  if(PRINT_SEARCH) { console.log('Survey mode', res.locals.survey); }

  next();
}

function post_termProcessing(req, res, next) {
  //Term reversing as promise
  var processing = termProcessing(res.locals.searchTerms[0], req.params.responseId);

  //Promise fulfilled
  processing.then((searchTerm_reverse) => {
    //Concat the reverse term with the root terms; if no reverse term, keep the root search term
    res.locals.searchTerms = searchTerm_reverse == "" ? res.locals.searchTerms : res.locals.searchTerms.concat(searchTerm_reverse);

    next();
  })
}

function post_search(req, res, next) {
  //The search method to use
  var implement = SEARCH_MODE == 'scrape' ? search_scrape : search_api;

  //Each search as a promise; wait for all resolved
  Promise
  .all(_.map(res.locals.searchTerms, (searchTerm) => { return implement(searchTerm, req.params.responseId); }))

  //Process fulfilled
  .then((result) => {

    //Search result based on survey mode
    switch(res.locals.survey) {
      case 5:
        result.splice(1, 1) //Remove result from the preset one
        res.locals.searchResult = resultProcessing(result, req.params.responseId);
        break;
      case 6:
        res.locals.searchResult = result[1].items.slice(0, 10);
        break;
      default:
        res.locals.searchResult = result[0].items.slice(0, 10);
    }
    
    //Print processed search result
    if(PRINT_SEARCH) { console.log(res.locals.searchResult); }
    
    next();
  });
}


//--Start server
//Command: NODE_ENV=production node server.js [SEARCH_MODE, [SERVER_OS, [O_MULTIPLIER]]]
app.listen(PORT_LISTENED, () => {
  logger.verbose(sprintf('Server listening on port %s..', PORT_LISTENED));
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
