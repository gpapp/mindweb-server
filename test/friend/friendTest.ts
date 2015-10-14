/// <reference path="../../typings/tsd.d.ts" />
import * as mocha from 'mocha';
import * as chai from 'chai';
import * as async from 'async';
import * as cassandra from 'cassandra-driver';

import * as fs from 'fs';
import FriendService from '../../services/FriendService';
import UserService from '../../services/UserService';


var rawConfig = fs.readFileSync('config/config.json');
var config = rawConfig.toString();
var assert = chai.assert;

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

cassandraClient.connect(function (error) {
    if (error) {
        throw 'Cannot connect to database';
    }
    console.log('Connected to database');
});


describe('Friend management', function () {
    var friendService = new FriendService(cassandraClient);
    var userService = new UserService(cassandraClient);
    var users = [];
    var friendIds = [];
    var createdUsers = 3;
    before(function (done) {
        this.timeout(createdUsers * 50);
        var i = 0;
        async.whilst(function () {
                return i < createdUsers;
            },
            function (next) {
                userService.createUser("friendTest:ID" + i, "Test User " + i, "test" + i + "@friend.com", "Test Avatar " + i, function (error, result) {
                    if (error) console.error(error.message);
                    users.push(result);
                    i++;
                    next();
                });
            },
            function (error) {
                done(error);
            }
        );
    });
    it("creates a friend", function (done) {
        this.timeout(createdUsers * 50);
        var i = 1;
        async.whilst(function () {
            return i < createdUsers;
        }, function (next) {
            friendService.createFriend(users[0].id, "Alias 0-" + i, users[i].id, function (error, result) {
                if (error) return done(error);
                friendIds.push(result.id);
                assert.equal(result.owner.toString(), users[0].id.toString(), 'Owner mismatch');
                assert.equal(result.linkedUser.toString(), users[i].id.toString(), 'Linkeduser mismatch');
                assert.equal(result.alias, "Alias 0-" + i, 'Alias mismatch');
                i++;
                next();
            });
        }, function () {
            done();
        });
    });
    it("creates an existing friend", function (done) {
        done();
    });
    it("find friend by characters", function (done) {
        done();
    });
    it("removes friend", function (done) {
        done();
    });
    after(function (done) {
        this.timeout(createdUsers * 50);
        var i = 0;
        async.whilst(function () {
            return i < createdUsers;
        }, function (next) {
            userService.deleteUser(users[i].id, function (error) {
                if (error) console.error(error);
                i++;
                next();
            });
        }, function () {
            done();
        });
    });
});
