// Importing the necessary libraries
var builder = require('botbuilder');
var https = require('https');
var querystring = require('querystring')
var restify = require('restify');
//var request = require('sync-request')
var request_promise = require('request-promise').defaults({ encoding: null });
var request = require('request');
var Promise = require('bluebird');
var request = require("request");
var cheerio = require("cheerio");

// 
var connector = new builder.ChatConnector();
var bot = new builder.UniversalBot(connector);

//var recognizer = new builder.LuisRecognizer(model)
//var intents = new builder.IntentDialog({recognizers: [recognizer]});

bot.dialog('/',[
    function(session,args,next){
        builder.Prompts.choice(session, 'Hi, I See that you are visiting an onclology center, there are several clinical trails on cancer, would you be intrested in participating in a clinical trial',['Yes','No'],{listStyle: builder.ListStyle.button})
    },
    function(session,results,next){
        console.log(results.response)
        if(results.response.entity == 'Yes'){
            builder.Prompts.choice(session,'Great! There are three ways we can proceed, ',['Upload a picture of the diagnosis report','upload a pdf of the report','enter the info manually'],{listStyle: builder.ListStyle.button});
            
        }
        else{
            session.endDialog('Ok, Have a good day!')
        }
    },
    function(session,results,next){
        if(results.response.entity == 'Upload a picture of the diagnosis report'){
            session.beginDialog('/imageUpload');
            //session.endDialog('image upload selected')
        
        } else if(results.response.entity == 'upload a pdf of the report'){
            session.beginDialog('/uploadPdf')
           // session.endDialog('pdf selected')
        } else {
            session.beginDialog('manualEntry')
            //session.endDialog('manual entry selected')
        }
    }
]);
bot.dialog('/imageUpload',[
    function(session,args,next){
    console.log('----------Image upload function executed-------------------')
        
        builder.Prompts.text(session,'Great!.Please enter your name');
    },
    function(session,results,next){
        session.userData.name = results.response;
        builder.Prompts.text(session,'Please enter your age');
    },
    function(session,results,next){
        session.userData.age = results.response;
        builder.Prompts.choice(session,'Please enter you gender',['Male','Female','Other'],{listStyle: builder.ListStyle.button});
    },
    function(session,results,next){
        session.userData.gender = results.response.entity;
        builder.Prompts.attachment(session,'Please upload you attachment here.')
    },
    function(session,results,next){
        var msg = session.message;
        var attachment = msg.attachments[0];
        console.log('---------------------------Image received---------------------------')
        if (attachment) {

            // Message with attachment, proceed to download it.
            // Skype & MS Teams attachment URLs are secured by a JwtToken, so we need to pass the token from our bot.
            console.log(attachment);

            var fileDownload = new Promise(
                function(resolve, reject) {
                    var check = checkRequiresToken(msg);
                    if  (check==true) {
                        resolve(requestWithToken(attachment.contentUrl));
                    } else {
                        resolve(request_promise(attachment.contentUrl));
                    }
                }
            );

            fileDownload.then(
                function (response) {

                readImageText(response, attachment.contentType, function (error, response, body) {
                    session.userData.diagonosisText = (extractText(body));
                    session.send(session.userData.diagonosisText)
                    var JSONobj = (extractDiagnosis(session.userData.diagonosisText))
                    session.userData.medicalCondition = 'Acute Myeloide Lucemia'
                    session.send('I am sorry to hear that you are suffering from '+session.userData.medicalCondition);
                    session.send('Here are some clinical trials you could be qualified for');
                    getTrials('lung cancer', function(options) {
                         //console.log(options)
                        for (item in options){
                            thisopt = options[item]
                            if(item < 5){
                            session.send((thisopt))}
                            else {
                                break
                            }
                        }
                    })
                   
                    
                });

                }).catch(function (err, reply) {
                    console.log('Error with attachment: ', { 
                        statusCode: err.statusCode, 
                        message: err });
                        session.send("Error with attachment or reading image with %s", err);
            });
        } 
    },
   
    //}
    
]);

// Helper methods

// Request file with Authentication Header
var requestWithToken = function (url) {
    return obtainToken().then(function (token) {
        return request_promise({
            url: url,
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/octet-stream'
            }
        });
    });
};

// Promise for obtaining JWT Token (requested once)
var obtainToken = Promise.promisify(connector.getAccessToken.bind(connector));

var checkRequiresToken = function (message) {
    return message.source === 'skype' || message.source === 'msteams';
};

//=========================================================
// Vision Service
//=========================================================

// A request with binary image data to OCR API
var readImageText = function _readImageText(url, content_type, callback) {

    var options = {
        method: 'POST',
        url: 'https://eastus2.api.cognitive.microsoft.com/vision/v1.0/ocr?language=unk&detectOrientation =true HTTP/1.1',
        headers: {
            'Ocp-Apim-Subscription-Key': '03da9800160e4929a3eb34358b82ec57',
            'Content-Type': 'application/octet-stream'
        },
        body: url,
        json: false
    };
    request(options, callback);

};

var readImageTextUrl = function _readImageTextUrl(url, content_type, callback) {

    var options = {
        method: 'POST',
        url: config.CONFIGURATIONS.COMPUTER_VISION_SERVICE.API_URL + "ocr/",
        headers: {
            'ocp-apim-subscription-key': config.CONFIGURATIONS.COMPUTER_VISION_SERVICE.API_KEY,
            'content-type': content_type
        },
        body: {url: url, language: "en"},
        json: true
    };

    request(options, callback);

};

// Get the text if present in the response from service
var extractText = function _extractText(bodyMessage) {

    var bodyJson = bodyMessage;

    // The attached images are json strings, the urls are not
    //  so only convert if we need to
    if (IsJsonString(bodyMessage)) {
        bodyJson = JSON.parse(bodyMessage);
    }

    // The "regions" - part of the json to drill down first level
    var regs = bodyJson.regions;
    text = "";

    if (typeof regs === "undefined") {return "Something's amiss, please try again.";};

    // Get line arrays
    var allLines = regs.map(x => x.lines);
    // Flatten array
    var allLinesFlat =  [].concat.apply([], allLines);
    // Get the words objects
    var allWords = allLinesFlat.map(x => x.words);
    // Flatten array
    var allWordsFlat = [].concat.apply([], allWords);
    // Get the text
    var allText = allWordsFlat.map(x => x.text);
    // Flatten
    var allTextFlat = [].concat.apply([], allText);

    text = allTextFlat.join(" ");

    if (text) {
        return text;
    } else {
        return "Could not find text in this image. :( Try again?";
    }
};

function IsJsonString(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}
var extractDiagnosis = function _extractDiagnosis(textblob){
    
  const NaturalLanguageUnderstandingV1 = require('watson-developer-cloud/natural-language-understanding/v1.js');

  const nlu = new NaturalLanguageUnderstandingV1({
    // note: if unspecified here, credentials are pulled from environment properties:
    // NATURAL_LANGUAGE_UNDERSTANDING_USERNAME &  NATURAL_LANGUAGE_UNDERSTANDING_PASSWORD
     username: '40ad5949-554a-48f4-993a-a46cd97c34fc',
     password: 'lmHW1TPNYk4f',
    version_date: NaturalLanguageUnderstandingV1.VERSION_DATE_2016_01_23
  });

  const options = {
    "text": textblob, // Text to analyze
    //"html": "string", // HTML to analyze
    //"url": req.query.url, // URL to analyze
    "features": {
      "concepts": {
        "limit": 8 // Maximum number of concepts to return
      },
      "emotion": {
        "document": true // Set this to false to hide document-level emotion results
      },
      "entities": {
        "limit": 50, // Maximum number of entities to return
        "sentiment": true, // Set this to true to return sentiment information for detected entities
        "emotion": true // Set this to true to analyze emotion for detected keywords
      },
      "keywords": {
        "limit": 50, // Maximum number of keywords to return
        "sentiment": true, // Set this to true to return sentiment information for detected keywords
        "emotion": true // Set this to true to analyze emotion for detected keywords
      },
      
      "semantic_roles": {
        "limit": 50, // Maximum number of semantic_roles results to return ,
        "keywords": false, // Set this to true to return keyword information for subjects and objects
        "entities": false // Set this to true to return entity information for subjects and objects
      },
      "sentiment": {
        "document": true // Set this to false to hide document-level sentiment results
      },
      "categories": {}
    }
  };

 console.log(nlu.analyze(options, function(err, response) {
   // console.log(response);
    if (err) {
      console.log(err);
      return;
    }
    //var JSONbody = JSON.parse(response)
    //console.log(response)
    return(response)
  }));
}
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





// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});
server.post('/api/messages', connector.listen());
