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
    ], (error: ServiceError) => {
        afterExecution(error, 'Updating session DB', callback)
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
