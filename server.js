const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const fs = require('fs');
const child_process = require('child_process');
const {google} = require('googleapis');
const customsearch = google.customsearch('v1');
const config = JSON.parse(fs.readFileSync(__dirname + '/config.json'))

//https://console.developers.google.com/apis/credentials
//https://developers.google.com/custom-search/json-api/v1/overview
//https://developers.google.com/custom-search/json-api/v1/reference/cse/list#request

// async function search(searchTerm) {
//   console.log();
//   const res = await customsearch.cse.list({
//     cx: config.CUSTOM_ENGINE_ID,
//     auth: config.API_KEY,
//     q: searchTerm
//   });
//   console.log(res.data);
//   return res.data;
// }
// search('good to health')

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', function (req, res) {
  res.render('index', {
    error: null,
    searchTerms: null,
    data: null
  });
});

app.post('/', function (req, res) {
  let search_term = req.body.search;

  let search = child_process.spawn('python', ['sub_search.py', search_term])

  let dataStream = '';
  search.stdout.on('data', (data) => {
    dataStream += data.toString();
  });
  search.stdout.on('end', () => {
    let obj = JSON.parse(dataStream);
    console.log(dataStream);

    res.render('index', {
      error: null,
      searchTerms: obj['searchTerms'],
      data: obj['items'].slice(0, 10)
    });
  });
});

app.listen(3000, function () {
  console.log('Server listening on port 3000..');
});