/**
 * Created by gpapp on 2015.06.08..
 */
var     async = require('async'),
    cassandra = require('cassandra-driver');

var client;

module.exports = function (inclient){
    client = inclient;
    async.parallel([
        sessionTable
    ], afterExecution("Error: ", 'Tables created'));
};

function sessionTable (next) {
    client.execute(
        'CREATE TABLE IF NOT EXISTS mindweb.sessions (' +
        '          sid text PRIMARY KEY,' +
        '          sobject text);',
        next);
}

function afterExecution(errorMessage, successMessage) {
    return function (err) {
        if (err) {
            console.error(errorMessage + err);
        } else {
            console.log(successMessage);
        }
    }
}