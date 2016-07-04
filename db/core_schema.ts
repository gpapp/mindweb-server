/// <reference path="../typings/tsd.d.ts" />

import * as fs from 'fs';
import * as async from 'async';
import * as cassandra from 'cassandra-driver';
import ServiceError from "../classes/ServiceError";

var client:cassandra.Client;

export default function (inClient:cassandra.Client, done:(error:ServiceError)=>void) {
    client = inClient;
    async.waterfall(
        [
            function (next) {
                versionTable(next);
            },
            function (next:(error:ServiceError, version:number)=>void) {
                lastVersion(next);
            },
            function (lastVersion:number, next) {
                console.log('DB on version ' + lastVersion);
                fs.readdir(__dirname + '/patches', function (error, filenames:string[]) {
                    if (error) return next(error);
                    if (filenames) {
                        var patches:string[] = [];
                        for (var i = 0; i < filenames.length; i++) {
                            if (/^patch_[0-9]{4}.js$/.test(filenames[i])) {
                                patches.push(/^(patch_[0-9]{4}).js$/.exec(filenames[i])[1]);
                            }
                        }
                        if (patches.length) {
                            patches = patches.sort();
                            async.each(patches, function (patch, nextPatch:(error?:ServiceError)=>void) {
                                    var patchversion:number = parseInt(/^patch_([0-9]{4})$/.exec(patch)[1]);
                                    if (patchversion > lastVersion) {
                                        console.log('Running patch:' + patch);
                                        var patchFunction = require('./patches/' + patch);
                                        patchFunction.default(inClient, afterExecution, function (error?:ServiceError) {
                                            if (error) return nextPatch(error);
                                            updateVersion(patchversion, function () {
                                                lastVersion = patchversion;
                                                nextPatch();
                                            });
                                        });
                                    } else {
                                        nextPatch();
                                    }
                                },
                                function (error:ServiceError) {
                                    next(error);
                                });
                        } else {
                            next();
                        }
                    } else {
                        next();
                    }
                });
            }
        ],
        function (error:ServiceError) {
            console.log(error.message);
            done(error);
        }
    )
};

function versionTable(next) {
    client.execute(
        'CREATE TABLE IF NOT EXISTS mindweb.version (' +
        '          object text PRIMARY KEY,' +
        '          version int);',
        function (error, result:cassandra.ExecuteResult) {
            if (error) return next(error);
            next();
        });
}

function lastVersion(next:(error:ServiceError, version?:number)=>void):void {
    client.execute(
        "SELECT version FROM mindweb.version WHERE object='mindweb';",
        function (error, result:cassandra.ExecuteResult) {
            if (error) return next(error);
            if (result.rows.length > 0) {
                next(null, result.rows[0]['version']);
            } else {
                next(null, -1);
            }
        });
}

function updateVersion(version:number, next:(error?:ServiceError)=>void):void {
    client.execute(
        'INSERT INTO mindweb.version (object, version) VALUES (:object,:version);',
        {object: "mindweb", version: version},
        {prepare: true},
        function (error, result:cassandra.ExecuteResult) {
            if (error) return next(error);
            next();
        });
}

function afterExecution(error:ServiceError, successMessage:string, callback:(error?:ServiceError)=>void):void {
    if (error) {
        console.error("Error:" + error.message);
    } else {
        console.log(successMessage);
    }
    callback(error);
}

