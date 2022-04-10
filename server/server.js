// Required modules:
var express = require('express');
var bodyParser = require('body-parser');

var app = express();

/** Request Parsing Middleware: **/
// for parsing application/json
app.use(bodyParser.json());
// for parsing application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

// Enable cross origin requests:
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// GET Params example:
app.get('/paramsexample/:name', function(req, res) {
    res.send(req.params);
    console.log('Params Example Served');
});

// GET query example:
app.get('/getexample', function(req, res) {
    res.send(req.query);
    console.log('Get Example Served');
});

// POST query example:
app.post('/postexample', function (req, res) {
    res.send(req.body);
    console.log('Post Example Served');
});

let messages = {};
let waiting_receivers = {};

app.post('/send_message', function (req, res) {
    let channel = req.body.channel;
    let message = req.body.message;
    if (!messages[channel]) {
        messages[channel] = [];
    }
    messages[channel].push(message);
    let waiting_receiver = waiting_receivers[channel];
    if (waiting_receiver) {
        message = messages[channel].shift();
        waiting_receivers[channel] = undefined;
        waiting_receiver(message);
    }
    res.send('sent');
    console.log('send_message');
});

app.post('/receive_message', function (req, res) {
    let channel = req.body.channel;
    if (messages[channel] && (messages[channel].length > 0)) {
        let message = messages[channel].shift();
        res.send(message);
        console.log('receive_message');
    } else {
        (() => {
            let _channel = channel;
            let onMessageArrived = (new_message) => {
                res.send(new_message);
                console.log('receive_message finished after wait');
            };
            waiting_receivers[channel] = onMessageArrived;
        })();
        console.log('receive_message waiting...');
    }
});

app.listen(3000);

console.log('Listening now...');
