base_url = "https://clinicaltrials.gov"

var request = require("request");
var cheerio = require("cheerio");

function splitJoin(term) {
  var words = term.split(" ");
  return words.join("+")
}

function getTrials(term, callback) {
  var results = [];
  var url = "https://clinicaltrials.gov/ct2/results?term=" + splitJoin(term) + "&recr=Recruiting&cntry1=NA%3AUS&state1=NA%3AUS%3ANY";

  request(url, function (error, response, body) {
    if (!error) {
      var $ = cheerio.load(body);
      $('tr td a').each(function() {
          hr = $(this).attr('href');
          link = base_url + hr
          results.push(link.split("?")[0])
      });
      callback(results)
    } else {
      console.log("We’ve encountered an error: " + error);
    }
  });
}

function getDescription(url) {
  request(url, function (error, response, body) {
    if (!error) {
      var $ = cheerio.load(body);
      desc = $('div.body3').text();
      console.log(desc)
    } else {
      console.log("We’ve encountered an error: " + error);
    }
  });
}

getTrials("lung cancer", function(results) {
  console.log(results)

  // getDescription(results[0].trim())
})
//console.log(listoftext)



