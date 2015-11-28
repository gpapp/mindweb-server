import ServiceError from "../../classes/ServiceError";
import * as cassandra from 'cassandra-driver';
import * as async from 'async';

var client:cassandra.Client;
export default function patch(cassandraClient:cassandra.Client,
                              afterExecution:(error:ServiceError, pass:string, callback:(error?:ServiceError)=>void)=>void,
                              callback:(error?:ServiceError)=>void) {
    client = cassandraClient;
    async.parallel([
        sessionTable,
        userTable,
        userPersonaTable,
        friendsTable,
        fileTable,
        fileVersionTable
    ], function (error:ServiceError) {
        afterExecution(error, 'Tables created', callback)
    });
}

function sessionTable(next) {
    client.execute(
        'CREATE TABLE IF NOT EXISTS mindweb.sessions (' +
        '          sid text PRIMARY KEY,' +
        '          sobject text);',
        next);
}

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
        'tags set<text>,' +
        'created timestamp,' +
        'modified timestamp);',
        function (err, res) {
            async.parallel([
                    function (nextI) {
                        client.execute('CREATE INDEX IF NOT EXISTS friends_owner_alias ON mindweb.friends (alias);', nextI);
                    }, function (nextI) {
                        client.execute('CREATE INDEX IF NOT EXISTS friends_owner ON mindweb.friends (owner);', nextI);
                    }, function (nextI) {
                        client.execute('CREATE INDEX IF NOT EXISTS friends_linkeduser ON mindweb.friends (linked_user);', nextI);
                    }, function (nextI) {
                        client.execute('CREATE INDEX IF NOT EXISTS friends_tags ON mindweb.friends (tags);', nextI);
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
        'tags set<text>,' +
        'created timestamp,' +
        'modified timestamp);',
        function (err, res) {
            async.parallel([
                    function (nextI) {
                        client.execute('CREATE INDEX IF NOT EXISTS file_owner ON mindweb.file (owner);', nextI);
                    },
                    function (nextI) {
                        client.execute('CREATE INDEX IF NOT EXISTS file_tags ON mindweb.file (tags);', nextI);
                    },
                    function (nextI) {
                        client.execute('CREATE INDEX IF NOT EXISTS file_public ON mindweb.file (public);', nextI);
                    },
                    function (nextI) {
                        client.execute('CREATE INDEX IF NOT EXISTS file_name ON mindweb.file (name);', nextI);
                    },
                    function (nextI) {
                        client.execute('CREATE INDEX IF NOT EXISTS file_viewers ON mindweb.file (viewers);', nextI);
                    },
                    function (nextI) {
                        client.execute('CREATE INDEX IF NOT EXISTS file_editors ON mindweb.file (editors);', nextI);
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

