const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const fs = require('fs');
const child_process = require('child_process');

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', function (req, res) {
  res.render('index', {
    weather: 'version 0.1',
    error: 'Error, please try again',
    city: null
  });
});

app.post('/', function (req, res) {
  let search_term = req.body.search;

  let search = child_process.spawn('python', ['search.py', search_term, 'sid'])

  let dataStream = '';
  search.stdout.on('data', (data) => {
    dataStream += data.toString();
  });
  search.stdout.on('end', () => {
    let obj = JSON.parse(dataStream).slice(0, 10);
    console.log(dataStream);

    res.render('index', {
      weather: null,
      error: 'Error, please try again',
      city: 'version 0.1',
      data: obj
    });
  });
});

app.listen(3000, function () {
  console.log('Server listening on port 3000..');
});