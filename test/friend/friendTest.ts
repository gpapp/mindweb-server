/// <reference path="../../typings/tsd.d.ts" />
import * as mocha from 'mocha';
import * as assert from 'assert';
import * as async from 'async';
import * as cassandra from 'cassandra-driver';

import * as fs from 'fs';
import FriendService from '../../services/FriendService';
import UserService from '../../services/UserService';


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

var cassandraClient = new cassandra.Client({
    contactPoints: [
        options.db.host
    ],
    protocolOptions: {
        port: options.db.port
    }
});

cassandraClient.connect(function (error, ok) {
    if (error) {
        throw 'Cannot connect to database';
    }
    console.log('Connected to database:' + ok);
});

var friendService = new FriendService(cassandraClient);
var userService = new UserService(cassandraClient);

var testFileId;
describe('Friend management', function () {
    var userId1;
    var userId2;
    before(function (next) {
        userService.createUser("friendTest:ID1", "Test User 1", "test1@friend.com", "Test Avatar 1", function (error, result) {
            if (error) {
                userService.getUserByAuthId("friendTest:ID1", function (error, result) {
                    userId1 = result.id;
                    console.log("User loaded:" + userId1);
                    next();
                });
            }
            else {
                userId1 = result.id;
                console.log("User created:" + userId1);
                next();
            }
        });
    });
    before(function (next) {
        userService.createUser("friendTest:ID2", "Test User 2", "test2@friend.com", "Test Avatar 2", function (error, result) {
            if (error) {
                userService.getUserByAuthId("friendTest:ID2", function (error, result) {
                    userId2 = result.id;
                    console.log("User loaded:" + userId2);
                    next();
                });
            }
            else {
                userId2 = result.id;
                console.log("User created:" + userId2);
                next();
            }
        });
    });
    it("creates a file in the database", function (done) {
        done();
    });
    it("Saves a file with identical content (no new version)", function (done) {
        done();
    });
    it("Saves a new version of a file with changed content (new version)", function (done) {
        done();
    });
    after(function (next) {
        userService.deleteUser(userId1, function (error) {
            if (error) {
                next(error);
            }
            console.log("User removed:" + userId1);
            next();
        });
    });
    after(function (next) {
        userService.deleteUser(userId2, function (error) {
            if (error) {
                next(error);
            }
            console.log("User removed:" + userId2);
            next();
        });
    });
});
