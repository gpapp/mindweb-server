/// <reference path="../typings/tsd.d.ts" />
import * as async from 'async';
import * as cassandra from 'cassandra-driver';

var client:cassandra.Client;

export default function initialize(inclient:cassandra.Client, next:Function) {
    client = inclient;
    async.parallel([
        sessionTable
    ], afterExecution("Error: ", 'Tables created', next));
}

function sessionTable(next) {
    client.execute(
        'CREATE TABLE IF NOT EXISTS mindweb.sessions (' +
        '          sid text PRIMARY KEY,' +
        '          sobject text);',
        next);
}

function afterExecution(errorMessage:string, successMessage:string, next:Function) {
    return function (err) {
        if (err) {
            console.error(errorMessage + err);
        } else {
            console.log(successMessage);
        }
        next();
    }
}