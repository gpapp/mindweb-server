import * as mocha from 'mocha';
import * as chai from 'chai';
import * as async from 'async';
import * as cassandra from 'cassandra-driver';

import * as fs from 'fs';
import File from "../../classes/File";
import Keyspace from '../../db/keyspace';
import CoreSchema from '../../db/core_schema';
import FileService from '../../services/FileService';
import UserService from '../../services/UserService';
import ServiceError from "../../classes/ServiceError";

var assert = chai.assert;
var cassandraClient;

describe("DB initialization", function () {
    this.timeout(60000);
    var rawConfig = fs.readFileSync('config/config.json');
    var config = rawConfig.toString();

    for (var key in process.env) {
        if (!process.env.hasOwnProperty(key)) {
            continue;
        }
        var re = new RegExp('\\$\\{' + key + '\\}', 'g');
        config = config.replace(re, process.env[key]);
    }
    var options = JSON.parse(config);

    console.log('Expecting DB on ' + options.db.host + ':' + options.db.port);
    var cassandraOptions = {
            contactPoints: [
                options.db.host
            ],
            protocolOptions: {
                "port": options.db.port as number,
                "maxSchemaAgreementWaitSeconds" : 5,
                "maxVersion" : 0
            },
            keyspace: "",
        };
    var innerCassandraClient;
    it("Creates keyspace", function (done) {

            async.waterfall([

                function (next) {
                    Keyspace(cassandraOptions, function (error:ServiceError) {
                        if (error) {
                            return next(error);
                        }
                        console.log('Keyspace created');
                        next();
                    });
                },

                function (next) {
                    cassandraOptions.keyspace = "mindweb";
                    innerCassandraClient = new cassandra.Client(cassandraOptions);

                    innerCassandraClient.connect(function (error:ServiceError) {
                        if (error) {
                            return next(error);
                        }
                        console.log('Connected to database');
                        next();
                    });
                },
                function (next) {
                    CoreSchema(innerCassandraClient, function (error:ServiceError) {
                        if (error) {
                            return next(error);
                        }
                        console.log('Schema created');
                        cassandraClient = innerCassandraClient;
                        next();
                    });
                }]
                ,function () {
                    done();
                }
            )
        }
    );

})

