/**
 * Created by gpapp on 2015.06.08..
 */
var async = require('async'),
    cassandra = require('cassandra-driver');

var client;

module.exports = function (inclient) {
    client = inclient;
    async.series(
        [keyspace,
            tables],
        function (error) {
            client.disconnect();
        }
    )
};

function keyspace(next) {
    client.execute("CREATE KEYSPACE IF NOT EXISTS mindweb WITH replication" +
        "={ 'class': 'SimpleStrategy', 'replication_factor': 1};",
        function () {
            afterExecution("Error: ", 'Keyspace created')();
            next()
        });
}

function tables(next) {
    async.parallel([
        userTable,
        fileTable,
        fileVersionTable
    ], afterExecution("Error: ", 'Tables created'));
}
function userTable(next) {
    client.execute(
        'CREATE TABLE IF NOT EXISTS mindweb.user (' +
        'id uuid PRIMARY KEY,' +
        'name text,' +
        'authId text,' +
        'avatarUrl text,' +
        'created timestamp,' +
        'modified timestamp);',
        function (err, res) {
            async.parallel(
                [function (nextI) {
                    client.execute(
                        'CREATE INDEX IF NOT EXISTS user_authId ON mindweb.user (authId);',
                        nextI);
                }]
                , next
            );
        });
}

function fileTable(next) {
    client.execute(
        'CREATE TABLE IF NOT EXISTS mindweb.file (' +
        'id uuid PRIMARY KEY,' +
        'name text,' +
        'owner uuid,' +
        'public boolean,' +
        'versions list<uuid>,' +
        'viewers list<uuid>,' +
        'editors list<uuid>,' +
        'created timestamp,' +
        'modified timestamp);',
        function (err, res) {
            async.parallel(
                [function (nextI) {
                    client.execute(
                        'CREATE INDEX IF NOT EXISTS file_owner ON mindweb.file (owner);',
                        nextI);
                },
                    function (nextI) {
                        client.execute(
                            'CREATE INDEX IF NOT EXISTS file_name ON mindweb.file (name);',
                            nextI);
                    }]
                , next
            );
        });
}

function fileVersionTable(next) {
    client.execute(
        'CREATE TABLE IF NOT EXISTS mindweb.fileVersion (' +
        'id uuid PRIMARY KEY,' +
        'version int,' +
        'created timestamp,' +
        'modified timestamp,' +
        'content blob);',
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

