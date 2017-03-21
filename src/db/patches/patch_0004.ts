import {ServiceError} from "mindweb-request-classes";
import * as cassandra from 'cassandra-driver';
import * as async from 'async';

var client: cassandra.Client;
export default function patch(cassandraClient: cassandra.Client,
                              afterExecution: (error: ServiceError, pass: string, callback: (error?: ServiceError) => void) => void,
                              callback: (error?: ServiceError) => void) {
    client = cassandraClient;
    async.parallel([
        addSessionColumn
    ], function (error: ServiceError) {
        afterExecution(error, 'Add expires to session db', callback)
    });
}

function addSessionColumn(next) {
    client.execute(
        'ALTER TABLE mindweb.sessions ADD expires timestamp;',
        // 'ALTER TABLE mindweb.sessions DROP expires;',
        next);
}
