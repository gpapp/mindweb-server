/// <reference path="../typings/tsd.d.ts" />

import * as async from 'async';
import * as cassandra from 'cassandra-driver';

var client:cassandra.Client;

export default function (inClient:cassandra.Client, next:Function) {
    client = inClient;
    async.parallel([
        userTable,
        userPersonaTable,
        friendsTable,
        fileTable,
        fileVersionTable
    ], afterExecution("Error: ", 'Tables created', next));
};

function userTable(next) {
    client.execute(
        'CREATE TABLE IF NOT EXISTS mindweb.user (' +
        'id uuid PRIMARY KEY,' +
        'name text,' +
        'email text,' +
        'persona list<text>,' +
        'avatarUrl text,' +
        'created timestamp,' +
        'modified timestamp);',
        function (err, res) {
            async.parallel([
                    function (nextI) {
                        client.execute('CREATE INDEX IF NOT EXISTS user_persona ON mindweb.user (persona);', nextI);
                    }, function (nextI) {
                        client.execute('CREATE INDEX IF NOT EXISTS user_email ON mindweb.user (email);', nextI);
                    },
                ], next
            );
        });
}
function userPersonaTable(next) {
    client.execute(
        'CREATE TABLE IF NOT EXISTS mindweb.user_persona (' +
        'authid text PRIMARY KEY,' +
        'name text,' +
        'email text,' +
        'avatarUrl text,' +
        'created timestamp,' +
        'modified timestamp);',
        function (err, res) {
            async.parallel([
                    function (nextI) {
                        client.execute('CREATE INDEX IF NOT EXISTS userpersona_name ON mindweb.user_persona (name);', nextI);
                    }, function (nextI) {
                        client.execute('CREATE INDEX IF NOT EXISTS userpersona_email ON mindweb.user_persona (email);', nextI);
                    },
                ], next
            );
        });
}

function friendsTable(next) {
    client.execute(
        'CREATE TABLE IF NOT EXISTS mindweb.friends (' +
        'id uuid PRIMARY KEY,' +
        'owner uuid,' +
        'alias text,' +
        'linked_user uuid,' +
        'created timestamp,' +
        'modified timestamp);',
        function (err, res) {
            async.parallel([
                    function (nextI) {
                        client.execute('CREATE INDEX IF NOT EXISTS friends_alias ON mindweb.friends (alias);', nextI);
                    }, function (nextI) {
                        client.execute('CREATE INDEX IF NOT EXISTS friends_linkeduser ON mindweb.friends (linked_user);', nextI);
                    }
                ], next
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
            async.parallel([
                    function (nextI) {
                        client.execute('CREATE INDEX IF NOT EXISTS file_owner ON mindweb.file (owner);', nextI);
                    },
                    function (nextI) {
                        client.execute('CREATE INDEX IF NOT EXISTS file_name ON mindweb.file (name);', nextI);
                    }
                ], next
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

function afterExecution(errorMessage, successMessage, next:Function) {
    return function (err) {
        if (err) {
            console.error(errorMessage + err);
        } else {
            console.log(successMessage);
        }
        next();
    }
}

