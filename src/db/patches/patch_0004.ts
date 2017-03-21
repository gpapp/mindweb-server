import {ServiceError} from "mindweb-request-classes";
import * as cassandra from 'cassandra-driver';
import * as async from 'async';

var client: cassandra.Client;
export default function patch(cassandraClient: cassandra.Client,
                              afterExecution: (error: ServiceError, pass: string, callback: (error?: ServiceError) => void) => void,
                              callback: (error?: ServiceError) => void) {
    client = cassandraClient;
    async.parallel([
        addSessionColumn1,
        addSessionColumn2,
        addSessionColumn3
    ], function (error: ServiceError) {
        afterExecution(error, 'Adding shareable column to mapDAO database', callback)
    });
}

function addSessionColumn1(next) {
    client.execute(
        'ALTER TABLE mindweb.sessions ADD session text;',
        next);
}
function addSessionColumn2(next) {
    client.execute(
        'ALTER TABLE mindweb.sessions ADD expire timestamp;',
        next);
}
function addSessionColumn3(next) {
    client.execute(
        'ALTER TABLE mindweb.sessions DROP sobject;',
        next);
}
