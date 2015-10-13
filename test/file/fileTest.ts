/// <reference path="../../typings/tsd.d.ts" />
import * as mocha from 'mocha';
import * as assert from 'assert';
import * as async from 'async';
import * as cassandra from 'cassandra-driver';

import * as fs from 'fs';
import File from "../../classes/File";
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

cassandraClient.connect(function (error, ok) {
    if (error) {
        throw 'Cannot connect to database';
    }
    console.log('Connected to database:' + ok);
});


describe('FileDAO file create', function () {
    var userId1;
    var userId2;
    var testFileId;
    var fileService = new FileService(cassandraClient);
    var userService = new UserService(cassandraClient);
    before(function (next) {
        userService.createUser("fileTest:ID1", "Test File User 1", "test1@file.com", "Test File Avatar 1", function (error, result) {
            if (error) {
                userService.getUserByAuthId("fileTest:ID1", function (error, result) {
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
        userService.createUser("fileTest:ID2", "Test File User 2", "test2@file.com", "Test File Avatar 2", function (error, result) {
            if (error) {
                userService.getUserByAuthId("fileTest:ID2", function (error, result) {
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
        fileService.createNewVersion(userId1, "Test fajl 1", false, null, null, "Test Content", function (error, result:File) {
            try {
                assert(error == null, "Cannot create test file: " + error);
                assert(result != null, "Result is empty");
                assert(!result.isPublic, "File is public");
                assert(result.editors === null, "Editors is not null");
                assert(result.viewers === null, "Viewers is not null");
                assert(result.canView(userId1), "View rights missing");
                assert(result.canEdit(userId1), "Edit rights missing");
                assert(result.canRemove(userId1), "Remove rights missing");
                assert(!result.canView(userId2), "Bogus view rights");
                assert(!result.canEdit(userId2), "Bogus edit rights");
                assert(!result.canRemove(userId2), "Bogus remove rights");
                testFileId = result.id;
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("Saves a file with identical content (no new version)", function (done) {
        fileService.createNewVersion(userId1, "Test fajl 1", true, null, null, "Test Content", function (error, result:File) {
            try {
                assert(error == null, "Cannot create test file: " + error);
                assert(result != null, "Result is empty");
                assert(result.id.toString() === testFileId.toString(), "FileService ids mismatched");
                assert(result.isPublic, "File is not public");
                assert(result.editors === null, "Editors is not null");
                assert(result.viewers === null, "Viewers is not null");
                assert(result.canView(userId1), "View rights missing");
                assert(result.canEdit(userId1), "Edit rights missing");
                assert(result.canRemove(userId1), "Remove rights missing");
                assert(result.canView(userId2), "Missing view rights");
                assert(!result.canEdit(userId2), "Bogus edit rights");
                assert(!result.canRemove(userId2), "Bogus remove rights");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("Saves a new version of a file with changed content (new version)", function (done) {
        fileService.createNewVersion(userId1, "Test fajl 1", true, null, null, "Test Content changed", function (error, result) {
            try {
                assert(error == null, "Cannot create test file: " + error);
                assert(result != null, "Result is empty");
                assert(result.id.toString() === testFileId.toString(), "FileService ids mismatched");
                assert(result.isPublic, "File is not public");
                assert(result.editors === null, "Editors is not null");
                assert(result.viewers === null, "Viewers is not null");
                assert(result.canView(userId1), "View rights missing");
                assert(result.canEdit(userId1), "Edit rights missing");
                assert(result.canRemove(userId1), "Remove rights missing");
                assert(result.canView(userId2), "Missing view rights");
                assert(!result.canEdit(userId2), "Bogus edit rights");
                assert(!result.canRemove(userId2), "Bogus remove rights");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("Renames a file", function (done) {
        fileService.renameFile(testFileId, "Test fajl 1 (renamed)", function (error, result:File) {
            try {
                assert(error == null, "Cannot rename test file: " + error);
                assert(result, "Result is empty");
                assert(result.isPublic, "File is not public");
                assert(result.editors === null, "Editors is not null");
                assert(result.viewers === null, "Viewers is not null");
                assert(result.canView(userId1), "View rights missing");
                assert(result.canEdit(userId1), "Edit rights missing");
                assert(result.canRemove(userId1), "Remove rights missing");
                assert(result.canView(userId2), "Missing view rights");
                assert(!result.canEdit(userId2), "Bogus edit rights");
                assert(!result.canRemove(userId2), "Bogus remove rights");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("Shares a file publicly", function (done) {
        fileService.shareFile(testFileId, true, null, null, function (error, result) {
            try {
                assert(error == null, "Cannot share file: " + error);
                assert(result, "Result is empty");
                fileService.getFile(testFileId, function (error, result:File) {
                    assert(result.id.toString() == testFileId.toString(), "Wrong file loaded");
                    assert(result.isPublic, "File is not public");
                    assert(result.editors === null, "Editors is not null");
                    assert(result.viewers === null, "Viewers is not null");
                    assert(result.canView(userId1), "View rights missing");
                    assert(result.canEdit(userId1), "Edit rights missing");
                    assert(result.canRemove(userId1), "Remove rights missing");
                    assert(result.canView(userId2), "Missing view rights");
                    assert(!result.canEdit(userId2), "Bogus edit rights");
                    assert(!result.canRemove(userId2), "Bogus remove rights");
                    done();
                });
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("Unshares a file publicly", function (done) {
        fileService.shareFile(testFileId, false, null, null, function (error, result) {
            try {
                assert(error == null, "Cannot share file: " + error);
                assert(result, "Result is empty");
                assert(result.id.toString() == testFileId.toString(), "Wrong file loaded");
                assert(!result.isPublic, "File is public");
                assert(result.editors === null, "Editors is not null");
                assert(result.viewers === null, "Viewers is not null");
                assert(result.canView(userId1), "View rights missing");
                assert(result.canEdit(userId1), "Edit rights missing");
                assert(result.canRemove(userId1), "Remove rights missing");
                assert(!result.canView(userId2), "Bogus view rights");
                assert(!result.canEdit(userId2), "Bogus edit rights");
                assert(!result.canRemove(userId2), "Bogus remove rights");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("Shares a file to a viewer", function (done) {
        fileService.shareFile(testFileId, false, [userId2], null, function (error, result) {
            try {
                assert(error == null, "Cannot unshare test file: " + error);
                assert(result, "Result is empty");
                assert(!result.isPublic, "File is public");
                assert(result.viewers, "Viewers is null");
                assert(result.viewers.length==1, "Viewers is not 1 long");
                assert(result.viewers[0].toString() ===userId2.toString(), "User doesn't match");
                assert(result.editors === null, "Editors is not null");
                assert(result.canView(userId1), "View rights missing");
                assert(result.canEdit(userId1), "Edit rights missing");
                assert(result.canRemove(userId1), "Remove rights missing");
                assert(result.canView(userId2), "Missing view rights");
                assert(!result.canEdit(userId2), "Bogus edit rights");
                assert(!result.canRemove(userId2), "Bogus remove rights");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("Shares a file to an existing viewer", function (done) {
        fileService.shareFile(testFileId, false, [userId2], null, function (error, result) {
            try {
                assert(error == null, "Cannot unshare test file: " + error);
                assert(result, "Result is empty");
                assert(!result.isPublic, "File is public");
                assert(result.viewers, "Viewers is null");
                assert(result.viewers.length==1, "Viewers is not 1 long");
                assert(result.viewers[0].toString() ===userId2.toString(), "User doesn't match");
                assert(result.editors === null, "Editors is not null");
                assert(result.canView(userId1), "View rights missing");
                assert(result.canEdit(userId1), "Edit rights missing");
                assert(result.canRemove(userId1), "Remove rights missing");
                assert(result.canView(userId2), "Missing view rights");
                assert(!result.canEdit(userId2), "Bogus edit rights");
                assert(!result.canRemove(userId2), "Bogus remove rights");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("Shares a file to an editor ", function (done) {
        fileService.shareFile(testFileId, false, null,[userId2], function (error, result) {
            try {
                assert(error == null, "Cannot unshare test file: " + error);
                assert(result, "Result is empty");
                assert(!result.isPublic, "File is public");
                assert(result.viewers === null, "Viewers  is not null");
                assert(result.editors, "Editors is null");
                assert(result.editors.length==1, "Editors is not 1 long");
                assert(result.editors[0].toString() ===userId2.toString(), "User doesn't match");
                assert(result.canView(userId1), "View rights missing");
                assert(result.canEdit(userId1), "Edit rights missing");
                assert(result.canRemove(userId1), "Remove rights missing");
                assert(result.canView(userId2), "Missing view rights");
                assert(result.canEdit(userId2), "Missing edit rights");
                assert(!result.canRemove(userId2), "Bogus remove rights");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("Shares a file to an existing editor", function (done) {
        fileService.shareFile(testFileId, true, null,[userId2], function (error, result) {
            try {
                assert(error == null, "Cannot unshare test file: " + error);
                assert(result, "Result is empty");
                assert(result.isPublic, "File is not public");
                assert(result.viewers === null, "Viewers  is not null");
                assert(result.editors, "Editors is null");
                assert(result.editors.length==1, "Editors is not 1 long");
                assert(result.editors[0].toString() ===userId2.toString(), "User doesn't match");
                assert(result.canView(userId1), "View rights missing");
                assert(result.canEdit(userId1), "Edit rights missing");
                assert(result.canRemove(userId1), "Remove rights missing");
                assert(result.canView(userId2), "Missing view rights");
                assert(result.canEdit(userId2), "Missing edit rights");
                assert(!result.canRemove(userId2), "Bogus remove rights");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("Shares a file to both viewer and editor", function (done) {
        fileService.shareFile(testFileId, true, [userId2,userId2,userId2],[userId2,userId2,userId2], function (error, result) {
            try {
                assert(error == null, "Cannot unshare test file: " + error);
                assert(result, "Result is empty");
                assert(result.isPublic, "File is not public");
                assert(result.viewers === null, "Viewers  is not null");
                assert(result.editors, "Editors is null");
                assert(result.editors.length==1, "Editors is not 1 long");
                assert(result.editors[0].toString() ===userId2.toString(), "User doesn't match");
                assert(result.canView(userId1), "View rights missing");
                assert(result.canEdit(userId1), "Edit rights missing");
                assert(result.canRemove(userId1), "Remove rights missing");
                assert(result.canView(userId2), "Missing view rights");
                assert(result.canEdit(userId2), "Missing edit rights");
                assert(!result.canRemove(userId2), "Bogus remove rights");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("Unshares a file from all editors and viewers and makes it public", function (done) {
        fileService.shareFile(testFileId, true, null, null, function (error, result) {
            try {
                assert(error == null, "Cannot unshare test file: " + error);
                assert(result, "Result is empty");
                assert(result.isPublic, "File is not public");
                assert(result.editors === null, "Editors is not null");
                assert(result.viewers === null, "Viewers is not null");
                assert(result.canView(userId1), "View rights missing");
                assert(result.canEdit(userId1), "Edit rights missing");
                assert(result.canRemove(userId1), "Remove rights missing");
                assert(result.canView(userId2), "Missing view rights");
                assert(!result.canEdit(userId2), "Bogus edit rights");
                assert(!result.canRemove(userId2), "Bogus remove rights");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("Unshares a file from all editors and viewers and makes it non-public", function (done) {
        fileService.shareFile(testFileId, false, null, null, function (error, result) {
            try {
                assert(error == null, "Cannot unshare test file: " + error);
                assert(result, "Result is empty");
                assert(!result.isPublic, "File is public");
                assert(result.editors === null, "Editors is not null");
                assert(result.viewers === null, "Viewers is not null");
                assert(result.canView(userId1), "View rights missing");
                assert(result.canEdit(userId1), "Edit rights missing");
                assert(result.canRemove(userId1), "Remove rights missing");
                assert(!result.canView(userId2), "Bogus view rights");
                assert(!result.canEdit(userId2), "Bogus edit rights");
                assert(!result.canRemove(userId2), "Bogus remove rights");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("Tries to unshare non-existing file", function (done) {
        fileService.shareFile("DUMMY_ID", true, null, null, function (error, result) {
            try {
                assert(error, "Should fail");
                assert(result == null, "Result is not empty");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("Deletes a file", function (done) {
        fileService.deleteFile(testFileId, function (error, result) {
            try {
                assert(error == null, "Cannot delete test file: " + error);
                assert(result === 'OK', "Result is empty");
                done();
            }
            catch (e) {
                done(e);
            }
        });
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
