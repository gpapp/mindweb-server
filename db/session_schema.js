/**
 * Created by gpapp on 2015.06.08..
 */
var     async = require('async'),
    cassandra = require('cassandra-driver');

var client;

module.exports = function (inclient){
    client = inclient;
    async.series(
        [keyspace,
            tables],
        function(error) {
            client.disconnect();
        }
    )
};

function keyspace (next) {
    client.execute("CREATE KEYSPACE IF NOT EXISTS mindweb WITH replication" +
        "={ 'class': 'SimpleStrategy', 'replication_factor': 1};",
        function() {
            afterExecution("Error: ", 'Keyspace created')();
            next()
        });
}

function tables (next) {
    async.parallel([
        sessionTable
    ], afterExecution("Error: ", 'Tables created'));
}
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