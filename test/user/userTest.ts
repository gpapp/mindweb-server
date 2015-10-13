/// <reference path="../../typings/tsd.d.ts" />
import * as mocha from 'mocha';
import * as assert from 'assert';
import * as async from 'async';
import * as cassandra from 'cassandra-driver';

import * as fs from 'fs';
import FileService from '../../services/FileService';
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
                assert(error == null, "Cannot create test user: " + error);
                assert(result, "Result is empty");
                assert(result.persona.length === 1, "Persona length is not 1");
                assert(result.persona[0] === 'TestID 1', "Auth id mismatch");
                assert(result.id, "Result userId is empty");
                assert(result.email, "test@a.com");
                assert(result.name, "Test User 1");
                assert(result.avatarUrl, "Test Avatar 1");
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
                assert(error != null, "Should throw error");
                assert(result, "Result is empty");
                assert(result.persona.length === 1, "Persona length is not 1");
                assert(result.persona[0] === 'TestID 1', "Auth id mismatch");
                assert(result.id, "Result userId is empty");
                assert(result.email, "test@a.com");
                assert(result.name, "Test User 1");
                assert(result.avatarUrl, "Test Avatar 1");
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
                assert(result, "Cannot find user");
                assert(result.persona.length === 1, "Persona length is not 1");
                assert(result.persona[0] === 'TestID 1', "Auth id mismatch");
                assert(result.id, "Result userId is empty");
                assert(result.name, "Test User 1");
                assert(result.email, "test@a.com");
                assert(result.name, "Test User 1");
                assert(result.avatarUrl, "Test Avatar 1");
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
    it("finds a user from the database", function (done) {
        userService.getUserByAuthId("TestID 1", function (error, result) {
            try {
                assert(result, "Cannot find user");
                userId1 = result.id;
                assert(result.persona.length === 1, "Persona length is not 1");
                assert(result.persona[0] === 'TestID 1', "Auth id mismatch");
                assert(result.id, "Result userId is empty");
                assert(result.name, "Test User 1");
                assert(result.email, "test@a.com");
                assert(result.name, "Test User 1");
                assert(result.avatarUrl, "Test Avatar 1");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("adds another user for cross link testing", function (done) {
        userService.createUser("TestID 2", "Test User 2", "test@b.com", "Test Avatar 2", function (error, result) {
            try {
                if (result) {
                    userId2 = result.id;
                }
                assert(error == null, "Cannot create test user: " + error);
                assert(result, "Result is empty");
                assert(result.persona.length === 1, "Persona length is not 1");
                assert(result.persona[0] === 'TestID 2', "Auth id mismatch");
                assert(result.id, "Result userId is empty");
                assert(result.email, "test@b.com");
                assert(result.name, "Test User 2");
                assert(result.avatarUrl, "Test Avatar 2");
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
                assert(error == null, "Cannot add new persona: " + error);
                assert(result, "Result is empty");
                assert(result.persona.length === 2, "Persona length is not 2");
                assert(result.persona[1] === 'TestID 3', "Auth id mismatch");
                assert(result.id, "Result userId is empty");
                assert(result.email, "test@a.com");
                assert(result.name, "Test User 1");
                assert(result.avatarUrl, "Test Avatar 1");
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
                assert(error == null, "Cannot add new persona: " + error);
                assert(result, "Result is empty");
                assert(result.persona.length === 2, "Persona length is not 2");
                assert(result.persona[1] === 'TestID 3', "Auth id mismatch");
                assert(result.id, "Result userId is empty");
                assert(result.email, "test@a.com");
                assert(result.name, "Test User 1");
                assert(result.avatarUrl, "Test Avatar 1");
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
                assert(error == null, "Cannot add new persona: " + error);
                assert(result, "Result is empty");
                assert(result.persona.length === 2, "Persona length is not 2");
                assert(result.persona[1] === 'TestID 3', "Auth id mismatch");
                assert(result.id, "Result userId is empty");
                assert(result.email, "test@c.com");
                assert(result.name, "Test name 3");
                assert(result.avatarUrl, "Test Avatar 3");
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
                assert(error, "Should fail");
                assert(result == null, "Should not have result");
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
                assert(error, "Should fail");
                assert(result == null, "Should not have result");
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
                assert(error, "Should not add persona: " + error);
                assert(result == null, "Result is not empty");
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
                assert(error == null, "Error removing persona: " + error);
                assert(result, "Result is empty");
                assert(result.persona.length === 1, "Persona length is not 1");
                assert(result.persona[0] === 'TestID 1', "Auth id mismatch");

                assert(result.id, "Result userId is empty");
                assert(result.email, "test@a.com");
                assert(result.name, "Test User 1");
                assert(result.avatarUrl, "Test Avatar 1");
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
                assert(error, "Should not remove non-existing persona: " + error);
                assert(result == null, "Result is not empty");
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
                assert(error, "Should not remove single persona: " + error);
                assert(result == null, "Result is not empty");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("removes the second user from the database", function (done) {
        userService.deleteUser(userId2, function (error, result) {
            try {
                assert(error == null, "Cannot remove test user: " + error);
                console.log("User removed:" + userId2);
                assert(result === undefined, "Result is not empty");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
});
describe('UserDAO userDelete', function () {
    var userId;
    var userService = new UserService(cassandraClient);
    var fileService = new FileService(cassandraClient);
    before(function (next) {
        userService.getUserByAuthId("TestID 1", function (error, result) {
            userId = result.id;
            next();
        });
    });
    before(function (next) {
        fileService.createNewVersion(userId, "Test fajl 1", false, null, null, "Test Content", function (error, result:File) {
            next();
        });
    });
    it("removes a user from the database", function (done) {
        userService.deleteUser(userId, function (error, result) {
            try {
                assert(error == null, "Cannot remove test user: " + error);
                console.log("User removed:" + userId);
                assert(result === undefined, "Result is not empty");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
});
