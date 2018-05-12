/*
------------------------------------------------------------
Set-up
------------------------------------------------------------
*/
//Base
const fs = require('fs');
const child_process = require('child_process');

//Config
const config = JSON.parse(fs.readFileSync(__dirname + '/config.json'));
process.argv[2];

//Server
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

//Google search official api
//https://console.developers.google.com/apis/credentials
//https://developers.google.com/custom-search/json-api/v1/overview
//https://developers.google.com/custom-search/json-api/v1/reference/cse/list#request
const {google} = require('googleapis');
const customsearch = google.customsearch('v1');




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
  console.log(res.data);
  return res.data;
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
    data: searchResult ? searchResult['items'].slice(0, 10) : null
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
      console.log(dataStream);

      resolve(dataStream);
    });
  });
}

test = termProcessing('beautiful');
test.then((dataStream) => { search_api(dataStream); })
search_api('beautiful');




/*
------------------------------------------------------------
Server Operation
------------------------------------------------------------
*/
app.get('/', function (req, res) {
  rend(res, null);
});

app.post('/', function (req, res) {
  var searchTerm = req.body.search;
  search_scrape(searchTerm, res, rend);
});

app.listen(3000, function () {
  console.log('Server listening on port 3000..');
});