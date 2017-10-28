import { before,describe, it, after } from "mocha";
import {assert} from "chai";
import * as app from "../../app";
import {MapContainer} from "mindweb-request-classes";
import {Friend} from "mindweb-request-classes";
import {ServiceError} from "mindweb-request-classes";
import FileService from "../../services/MapService";
import UserService from "../../services/UserService";
import FriendService from "../../services/FriendService";

let userService: UserService;
let fileService:FileService;
let friendService:FriendService;

before((next) => {
    app.initialize(next);
});
before((next) => {
    userService = new UserService(app.cassandraClient);
    fileService = new FileService(app.cassandraClient);
    friendService = new FriendService(app.cassandraClient);
    next();
});

describe('UserDAO userCreate', () => {
    it("creates a user in the database", (done) => {
        userService.createUser("TestID 1", "Test User 1", "test@a.com", "Test Avatar 1", (error, result) => {
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
    it("recreates a user in the database", (done) => {
        userService.createUser("TestID 1", "Test User 11", "test1@a.com", "Test Avatar 11", (error, result) => {
            try {
                assert(error != null, "Should throw error");
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
describe('UserDAO getUser', () => {
    it("finds a user from the database", (done) => {
        userService.getUserByAuthId("TestID 1", (error, result) => {
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
describe('UserDAO Persona test', () => {
    var userId1;
    var userId2;
    before((done) => {
        userService.createUser("TestID 2", "Test User 2", "test@b.com", "Test Avatar 2", (error, result) => {
            userId2 = result.id;
            done();
        });
    });
    it("finds a user from the database", (done) => {
        userService.getUserByAuthId("TestID 1", (error, result) => {
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
    it("adds a persona to it", (done) => {
        userService.addPersona(userId1, "TestID 3", 'Test name 3', 'test@c.com', 'Test Avatar 3', (error, result) => {
            try {
                assert.isNull(error, "Cannot add new persona: " + error);
                assert.isNotNull(result, "Result is empty");
                assert.equal(result.persona.length, 2, "Persona length is not 2");
                assert(result.persona[1] === 'TestID 3', "Auth id mismatch");
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
    it("adds an existing persona to first user", (done) => {
        userService.addPersona(userId1, "TestID 3", 'Test name 3', 'test@c.com', 'Test Avatar 3', (error, result) => {
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
    it("selects another main persona for the first user", (done) => {
        userService.selectMainPersona(userId1, "TestID 3", (error, result) => {
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
    it("selects another main persona for non-existing user", (done) => {
        userService.selectMainPersona('00000000-0000-0000-0000-000000000000', "TestID 3", (error, result) => {
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
    it("selects another main persona for non-existing persona", (done) => {
        userService.selectMainPersona(userId1, "TestID X", (error, result) => {
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
    it("adds an existing persona to second user", (done) => {
        userService.addPersona(userId2, "TestID 3", 'Test name 3', 'test@c.com', 'Test Avatar 3', (error, result) => {
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
    it("remove existing persona from first user", (done) => {
        userService.removePersona(userId1, "TestID 3", (error, result) => {
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
    it("remove non-existing persona from first user", (done) => {
        userService.removePersona(userId1, "TestID 3", (error, result) => {
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
    it("remove single persona from first user", (done) => {
        userService.removePersona(userId1, "TestID 1", (error, result) => {
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
    after((done) => {
        userService.deleteUser(userId2, (error: ServiceError) => {
            done();
        });
    });
});
describe('UserDAO userDelete', () => {
    var userId1;
    var userId2;
    before((next) => {
        userService.getUserByAuthId("TestID 1", (error, result) => {
            userId1 = result.id;
            next();
        });
    });
    before((next) => {
        userService.createUser("Test User ID2", "Test User 2", "test2@user.com", "Test Avatar 2", (error, result) => {
            userId2 = result.id;
            next();
        });
    });
    before((next) => {
        fileService.createNewVersion(userId1, "Test fajl 1", true, false, null, null, ['tag1', 'tag2'], "Test Content",
            (error: ServiceError, result: MapContainer) => {
                next();
            });
    });
    before((next) => {
        friendService.createFriend(userId1, "Alias User  1-2", userId2, [], (error: ServiceError, result: Friend) => {
            next();
        });
    });
    before((next) => {
        friendService.createFriend(userId2, "Alias User  2-1", userId1, [], (error: ServiceError, result: Friend) => {
            next();
        });
    });
    it("removes a user from the database", (done) => {
        userService.deleteUser(userId1, (error: ServiceError) => {
            try {
                assert.isUndefined(error, "Cannot remove test user: " + error);
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    after((next) => {
        userService.deleteUser(userId2, (error: ServiceError) => {
            next();
        });
    });
});
