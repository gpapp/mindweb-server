import * as fs from 'fs';
import * as async from 'async';
import * as cassandra from 'cassandra-driver';
import {ServiceError} from "mindweb-request-classes";

var client:cassandra.Client;

export default function (inClient:cassandra.Client, done:(error:ServiceError)=>void) {
    client = inClient;
    async.waterfall(
        [
            (next) => {
                versionTable(next);
            },
            function (next:(error:ServiceError, version:number)=>void) {
                lastVersion(next);
            },
            (lastVersion:number, next) => {
                console.log('DB on version ' + lastVersion);
                fs.readdir(__dirname + '/patches', (error, filenames:string[]) => {
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
                            async.eachSeries(patches, function (patch, nextPatch:(error?:ServiceError)=>void) {
                                    var patchversion:number = parseInt(/^patch_([0-9]{4})$/.exec(patch)[1]);
                                    if (patchversion > lastVersion) {
                                        console.log('Running patch:' + patch);
                                        var patchFunction = require('./patches/' + patch);
                                        patchFunction.default(inClient, afterExecution, (error?:ServiceError) => {
                                            if (error) return nextPatch(error);
                                            updateVersion(patchversion, () => {
                                                lastVersion = patchversion;
                                                nextPatch();
                                            });
                                        });
                                    } else {
                                        nextPatch();
                                    }
                                },
                                (error:ServiceError) => {
                                    if(error) {
                                        console.error('Error in execution: '+error.message);
                                    }
                                    next(error);
                                });
                        } else {
                            console.log('No patch required');
                            next();
                        }
                    } else {
                        next();
                    }
                });
            }
        ],
        (error:ServiceError) => {
            if (error) {
                console.log(error.message);
            }
            done(error);
        }
    )
};

function versionTable(next) {
    client.execute(
        'CREATE TABLE IF NOT EXISTS mindweb.version (' +
        '          object text PRIMARY KEY,' +
        '          version int);',
        (error, result:cassandra.types.ResultSet) => {
            if (error) return next(error);
            next();
        });
}

function lastVersion(next:(error:ServiceError, version?:number)=>void):void {
    client.execute(
        "SELECT version FROM mindweb.version WHERE object='mindweb';",
        (error, result:cassandra.types.ResultSet) => {
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
        (error:ServiceError, result:cassandra.types.ResultSet) => {
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

