/// <reference path="../../typings/tsd.d.ts" />
import * as mocha from 'mocha';
import * as chai from 'chai';
import * as async from 'async';
import * as cassandra from 'cassandra-driver';
import * as fs from 'fs';

import File from "../../classes/File";
import FileVersion from "../../classes/FileVersion";
import ServiceError from "../../classes/ServiceError";
import FileService from '../../services/FileService';
import UserService from '../../services/UserService';
import FriendService from "../../services/FriendService";

var assert = chai.assert;

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

before(function (next) {
    cassandraClient.connect(function (error) {
        if (error) {
            throw 'Cannot connect to database';
        }
        console.log('Connected to database');
        next();
    });
});
describe('UserDAO userCreate', function () {
    var userService = new UserService(cassandraClient);
    it("creates a user in the database", function (done) {
        userService.createUser("TestID 1", "Test User 1", "test@a.com", "Test Avatar 1", function (error, result) {
            try {
                assert.isNull(error, "Cannot create test user: " + error);
                assert.isNotNull(result, "Result is empty");
                assert.equal(result.persona.length, 1, "Persona length is not 1");
                assert.equal(result.persona[0], 'TestID 1', "Auth id mismatch");
                assert.isNotNull(result.id, "Result userId is empty");
                assert.equal(result.email, "test@a.com");
                assert.equal(result.name, "Test User 1");
                assert.equal(result.avatarUrl, "Test Avatar 1");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("recreates a user in the database", function (done) {
        userService.createUser("TestID 1", "Test User 11", "test1@a.com", "Test Avatar 11", function (error, result) {
            try {
                chai.assert(error != null, "Should throw error");
                assert.isNotNull(result, "Result is empty");
                assert.equal(result.persona.length, 1, "Persona length is not 1");
                assert.equal(result.persona[0], 'TestID 1', "Auth id mismatch");
                assert.isNotNull(result.id, "Result userId is empty");
                assert.equal(result.email, "test@a.com");
                assert.equal(result.name, "Test User 1");
                assert.equal(result.avatarUrl, "Test Avatar 1");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
});
describe('UserDAO getUser', function () {
    var userService = new UserService(cassandraClient);
    it("finds a user from the database", function (done) {
        userService.getUserByAuthId("TestID 1", function (error, result) {
            try {
                assert.isNotNull(result, "Cannot find user");
                assert.equal(result.persona.length, 1, "Persona length is not 1");
                assert.equal(result.persona[0], 'TestID 1', "Auth id mismatch");
                assert.isNotNull(result.id, "Result userId is empty");
                assert.equal(result.name, "Test User 1");
                assert.equal(result.email, "test@a.com");
                assert.equal(result.name, "Test User 1");
                assert.equal(result.avatarUrl, "Test Avatar 1");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
});
describe('UserDAO Persona test', function () {
    var userService = new UserService(cassandraClient);
    var userId1;
    var userId2;
    before(function (done) {
        userService.createUser("TestID 2", "Test User 2", "test@b.com", "Test Avatar 2", function (error, result) {
            userId2 = result.id;
            done();
        });
    });
    it("finds a user from the database", function (done) {
        userService.getUserByAuthId("TestID 1", function (error, result) {
            try {
                assert.isNotNull(result, "Cannot find user");
                userId1 = result.id;
                assert.equal(result.persona.length, 1, "Persona length is not 1");
                assert.equal(result.persona[0], 'TestID 1', "Auth id mismatch");
                assert.isNotNull(result.id, "Result userId is empty");
                assert.equal(result.name, "Test User 1");
                assert.equal(result.email, "test@a.com");
                assert.equal(result.name, "Test User 1");
                assert.equal(result.avatarUrl, "Test Avatar 1");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("adds a persona to it", function (done) {
        userService.addPersona(userId1, "TestID 3", 'Test name 3', 'test@c.com', 'Test Avatar 3', function (error, result) {
            try {
                assert.isNull(error, "Cannot add new persona: " + error);
                assert.isNotNull(result, "Result is empty");
                assert.equal(result.persona.length, 2, "Persona length is not 2");
                chai.assert(result.persona[1] === 'TestID 3', "Auth id mismatch");
                assert.isNotNull(result.id, "Result userId is empty");
                assert.equal(result.email, "test@a.com");
                assert.equal(result.name, "Test User 1");
                assert.equal(result.avatarUrl, "Test Avatar 1");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("adds an existing persona to first user", function (done) {
        userService.addPersona(userId1, "TestID 3", 'Test name 3', 'test@c.com', 'Test Avatar 3', function (error, result) {
            try {
                assert.isNull(error, "Cannot add new persona: " + error);
                assert.isNotNull(result, "Result is empty");
                assert.equal(result.persona.length, 2, "Persona length is not 2");
                assert.equal(result.persona[1], 'TestID 3', "Auth id mismatch");
                assert.isNotNull(result.id, "Result userId is empty");
                assert.equal(result.email, "test@a.com");
                assert.equal(result.name, "Test User 1");
                assert.equal(result.avatarUrl, "Test Avatar 1");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("selects another main persona for the first user", function (done) {
        userService.selectMainPersona(userId1, "TestID 3", function (error, result) {
            try {
                assert.isNull(error, "Cannot add new persona: " + error);
                assert.isNotNull(result, "Result is empty");
                assert.equal(result.persona.length, 2, "Persona length is not 2");
                assert.equal(result.persona[1], 'TestID 3', "Auth id mismatch");
                assert.isNotNull(result.id, "Result userId is empty");
                assert.equal(result.email, "test@c.com");
                assert.equal(result.name, "Test name 3");
                assert.equal(result.avatarUrl, "Test Avatar 3");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("selects another main persona for non-existing user", function (done) {
        userService.selectMainPersona('00000000-0000-0000-0000-000000000000', "TestID 3", function (error, result) {
            try {
                assert.isNotNull(error, "Should fail");
                assert.isUndefined(result, "Should not have result");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("selects another main persona for non-existing persona", function (done) {
        userService.selectMainPersona(userId1, "TestID X", function (error, result) {
            try {
                assert.isNotNull(error, "Should fail");
                assert.isUndefined(result, "Should not have result");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("adds an existing persona to second user", function (done) {
        userService.addPersona(userId2, "TestID 3", 'Test name 3', 'test@c.com', 'Test Avatar 3', function (error, result) {
            try {
                assert.isNotNull(error, "Should fail");
                assert.isUndefined(result, "Should not have result");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("remove existing persona from first user", function (done) {
        userService.removePersona(userId1, "TestID 3", function (error, result) {
            try {
                assert.isNull(error, "Error removing persona: " + error);
                assert.isNotNull(result, "Result is empty");
                assert.equal(1, result.persona.length, "Persona length");
                assert.equal('TestID 1', result.persona[0], "Auth id mismatch");

                assert.isNotNull(result.id, "Result userId is empty");
                assert.equal(result.email, "test@a.com");
                assert.equal(result.name, "Test User 1");
                assert.equal(result.avatarUrl, "Test Avatar 1");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("remove non-existing persona from first user", function (done) {
        userService.removePersona(userId1, "TestID 3", function (error, result) {
            try {
                assert.isNotNull(error, "Should fail");
                assert.isUndefined(result, "Should not have result");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("remove single persona from first user", function (done) {
        userService.removePersona(userId1, "TestID 1", function (error, result) {
            try {
                assert.isNotNull(error, "Should fail");
                assert.isUndefined(result, "Should not have result");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    after(function (done) {
        userService.deleteUser(userId2, function (error, result) {
            done();
        });
    });
});
describe('UserDAO userDelete', function () {
    var userService = new UserService(cassandraClient);
    var fileService = new FileService(cassandraClient);
    var friendService = new FriendService(cassandraClient);
    var userId1;
    var userId2;
    before(function (next) {
        userService.getUserByAuthId("TestID 1", function (error, result) {
            userId1 = result.id;
            next();
        });
    });
    before(function (next) {
        userService.createUser("Test User ID2", "Test User 2", "test2@user.com", "Test Avatar 2", function (error, result) {
            userId2 = result.id;
            next();
        });
    });
    before(function (next) {
        fileService.createNewVersion(userId1, "Test fajl 1", false, null, null, ['tag1','tag2'], "Test Content",
            function (error:ServiceError, result:File) {
            next();
        });
    });
    before(function (next) {
        friendService.createFriend(userId1, "Alias User  1-2", userId2, [], function (error, result:File) {
            next();
        });
    });
    before(function (next) {
        friendService.createFriend(userId2, "Alias User  2-1", userId1, [], function (error, result:File) {
            next();
        });
    });
    it("removes a user from the database", function (done) {
        userService.deleteUser(userId1, function (error, result) {
            try {
                assert.isUndefined(error, "Cannot remove test user: " + error);
                assert.isUndefined(result, "Should not have result");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    after(function (next) {
        userService.deleteUser(userId2, function (error, result) {
            next();
        });
    });
});
