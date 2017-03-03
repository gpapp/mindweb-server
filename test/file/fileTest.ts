import {assert} from "chai";
import * as app from "../../app";
import File from "mindweb-request-classes/dist/classes/File";
import FileService from "../../services/FileService";
import UserService from "../../services/UserService";

let userService: UserService;
let fileService: FileService;

before(function (next) {
    app.initialize(next);
});
before(function (next) {
    userService = new UserService(app.cassandraClient);
    fileService = new FileService(app.cassandraClient);
    next();
});


describe('FileDAO file create', function () {
    var userId1;
    var userId2;
    var testFileId;
    before(function (next) {
        userService.createUser("fileTest:ID1", "Test MyFile User 1", "test1@file.com", "Test MyFile Avatar 1", function (error, result) {
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
        userService.createUser("fileTest:ID2", "Test MyFile User 2", "test2@file.com", "Test MyFile Avatar 2", function (error, result) {
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
        fileService.createNewVersion(userId1, "Test fajl 1", false, false, null, null, ['tag1', 'tag2'], "Test Content", function (error, result: File) {
            try {
                assert.isNull(error, "Cannot create test file: " + error);
                assert.isNotNull(result, "Result is empty");
                assert.isFalse(result.isShareable, "MyFile is shareable");
                assert.isFalse(result.isPublic, "MyFile is public");
                assert.isNull(result.editors, "Editors is not null");
                assert.isNull(result.viewers, "Viewers is not null");
                assert.isTrue(result.canView(userId1), "View rights missing");
                assert.isTrue(result.canEdit(userId1), "Edit rights missing");
                assert.isTrue(result.canRemove(userId1), "Remove rights missing");
                assert.isFalse(result.canView(userId2), "Bogus view rights");
                assert.isFalse(result.canEdit(userId2), "Bogus edit rights");
                assert.isFalse(result.canRemove(userId2), "Bogus remove rights");
                testFileId = result.id;
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("Saves a file with identical content (no new version)", function (done) {
        fileService.createNewVersion(userId1, "Test fajl 1", true, true, null, null, ['tag1', 'tag2'], "Test Content", function (error, result: File) {
            try {
                assert.isNull(error, "Cannot create test file: " + error);
                assert.isNotNull(result, "Result is empty");
                assert.equal(result.id.toString(), testFileId.toString(), "FileService ids mismatched");
                assert.isTrue(result.isShareable, "MyFile is not shareable");
                assert.isTrue(result.isPublic, "MyFile is not public");
                assert.isNull(result.editors, "Editors is not null");
                assert.isNull(result.viewers, "Viewers is not null");
                assert.isTrue(result.canView(userId1), "View rights missing");
                assert.isTrue(result.canEdit(userId1), "Edit rights missing");
                assert.isTrue(result.canRemove(userId1), "Remove rights missing");
                assert.isTrue(result.canView(userId2), "Missing view rights");
                assert.isFalse(result.canEdit(userId2), "Bogus edit rights");
                assert.isFalse(result.canRemove(userId2), "Bogus remove rights");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("Saves a new version of a file with changed content (new version)", function (done) {
        fileService.createNewVersion(userId1, "Test fajl 1", true, true, null, null, ['tag1', 'tag2'], "Test Content changed", function (error, result) {
            try {
                assert.isNull(error, "Cannot create test file: " + error);
                assert.isNotNull(result, "Result is empty");
                assert.equal(result.id.toString(), testFileId.toString(), "FileService ids mismatched");
                assert.isTrue(result.isShareable, "MyFile is not shareable");
                assert.isTrue(result.isPublic, "MyFile is not public");
                assert.isNull(result.editors, "Editors is not null");
                assert.isNull(result.viewers, "Viewers is not null");
                assert.isTrue(result.canView(userId1), "View rights missing");
                assert.isTrue(result.canEdit(userId1), "Edit rights missing");
                assert.isTrue(result.canRemove(userId1), "Remove rights missing");
                assert.isTrue(result.canView(userId2), "Missing view rights");
                assert.isFalse(result.canEdit(userId2), "Bogus edit rights");
                assert.isFalse(result.canRemove(userId2), "Bogus remove rights");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("Renames a file", function (done) {
        fileService.renameFile(testFileId, "Test fajl 1 (renamed)", function (error, result: File) {
            try {
                assert.isNull(error, "Cannot rename test file: " + error);
                assert.isNotNull(result, "Result is empty");
                assert.isTrue(result.isPublic, "MyFile is not public");
                assert.isNull(result.editors, "Editors is not null");
                assert.isNull(result.viewers, "Viewers is not null");
                assert.isTrue(result.canView(userId1), "View rights missing");
                assert.isTrue(result.canEdit(userId1), "Edit rights missing");
                assert.isTrue(result.canRemove(userId1), "Remove rights missing");
                assert.isTrue(result.canView(userId2), "Missing view rights");
                assert.isFalse(result.canEdit(userId2), "Bogus edit rights");
                assert.isFalse(result.canRemove(userId2), "Bogus remove rights");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("Shares a file publicly", function (done) {
        fileService.shareFile(testFileId, true, true, null, null, function (error, result) {
            try {
                assert.isNull(error, "Cannot share file: " + error);
                assert.isNotNull(result, "Result is empty");
                fileService.getFile(testFileId, function (error, result: File) {
                    assert.equal(result.id.toString(), testFileId.toString(), "Wrong file loaded");
                    assert.isTrue(result.isShareable, "MyFile is not shareable");
                    assert.isTrue(result.isPublic, "MyFile is not public");
                    assert.isNull(result.editors, "Editors is not null");
                    assert.isNull(result.viewers, "Viewers is not null");
                    assert.isTrue(result.canView(userId1), "View rights missing");
                    assert.isTrue(result.canEdit(userId1), "Edit rights missing");
                    assert.isTrue(result.canRemove(userId1), "Remove rights missing");
                    assert.isTrue(result.canView(userId2), "Missing view rights");
                    assert.isFalse(result.canEdit(userId2), "Bogus edit rights");
                    assert.isFalse(result.canRemove(userId2), "Bogus remove rights");
                    done();
                });
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("Unshares a file publicly with share-through-link", function (done) {
        fileService.shareFile(testFileId, true, false, null, null, function (error, result) {
            try {
                assert.isNull(error, "Cannot share file: " + error);
                assert.isNotNull(result, "Result is empty");
                assert.equal(result.id.toString(), testFileId.toString(), "Wrong file loaded");
                assert.isTrue(result.isShareable, "MyFile is not shareable");
                assert.isFalse(result.isPublic, "MyFile is public");
                assert.isNull(result.editors, "Editors is not null");
                assert.isNull(result.viewers, "Viewers is not null");
                assert.isTrue(result.canView(userId1), "View rights missing");
                assert.isTrue(result.canEdit(userId1), "Edit rights missing");
                assert.isTrue(result.canRemove(userId1), "Remove rights missing");
                assert.isTrue(result.canView(userId2), "Missing view rights");
                assert.isFalse(result.canEdit(userId2), "Bogus edit rights");
                assert.isFalse(result.canRemove(userId2), "Bogus remove rights");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("Unshares a file publicly without share-through link", function (done) {
        fileService.shareFile(testFileId, false, false, null, null, function (error, result) {
            try {
                assert.isNull(error, "Cannot share file: " + error);
                assert.isNotNull(result, "Result is empty");
                assert.equal(result.id.toString(), testFileId.toString(), "Wrong file loaded");
                assert.isFalse(result.isShareable, "MyFile is not shareable");
                assert.isFalse(result.isPublic, "MyFile is public");
                assert.isNull(result.editors, "Editors is not null");
                assert.isNull(result.viewers, "Viewers is not null");
                assert.isTrue(result.canView(userId1), "View rights missing");
                assert.isTrue(result.canEdit(userId1), "Edit rights missing");
                assert.isTrue(result.canRemove(userId1), "Remove rights missing");
                assert.isFalse(result.canView(userId2), "Bogus view rights");
                assert.isFalse(result.canEdit(userId2), "Bogus edit rights");
                assert.isFalse(result.canRemove(userId2), "Bogus remove rights");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("Shares a file to a viewer", function (done) {
        fileService.shareFile(testFileId, true, false, [userId2], null, function (error, result) {
            try {
                assert.isNull(error, "Cannot unshare test file: " + error);
                assert.isNotNull(result, "Result is empty");
                assert.isTrue(result.isShareable, "MyFile is not shareable");
                assert.isFalse(result.isPublic, "MyFile is public");
                assert.isNotNull(result.viewers, "Viewers is null");
                assert.equal(result.viewers.length, 1, "Viewers is not 1 long");
                assert.equal(result.viewers[0].toString(), userId2.toString(), "User doesn't match");
                assert.isNull(result.editors, "Editors is not null");
                assert.isTrue(result.canView(userId1), "View rights missing");
                assert.isTrue(result.canEdit(userId1), "Edit rights missing");
                assert.isTrue(result.canRemove(userId1), "Remove rights missing");
                assert.isTrue(result.canView(userId2), "Missing view rights");
                assert.isFalse(result.canEdit(userId2), "Bogus edit rights");
                assert.isFalse(result.canRemove(userId2), "Bogus remove rights");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("Shares a file to an existing viewer", function (done) {
        fileService.shareFile(testFileId, true, false, [userId2], null, function (error, result) {
            try {
                assert.isNull(error, "Cannot unshare test file: " + error);
                assert.isNotNull(result, "Result is empty");
                assert.isTrue(result.isShareable, "MyFile is not shareable");
                assert.isFalse(result.isPublic, "MyFile is public");
                assert.isNotNull(result.viewers, "Viewers is null");
                assert.equal(result.viewers.length, 1, "Viewers is not 1 long");
                assert.equal(result.viewers[0].toString(), userId2.toString(), "User doesn't match");
                assert.isNull(result.editors, "Editors is not null");
                assert.isTrue(result.canView(userId1), "View rights missing");
                assert.isTrue(result.canEdit(userId1), "Edit rights missing");
                assert.isTrue(result.canRemove(userId1), "Remove rights missing");
                assert.isTrue(result.canView(userId2), "Missing view rights");
                assert.isFalse(result.canEdit(userId2), "Bogus edit rights");
                assert.isFalse(result.canRemove(userId2), "Bogus remove rights");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("Shares a file to an editor ", function (done) {
        fileService.shareFile(testFileId, true, false, null, [userId2], function (error, result) {
            try {
                assert.isNull(error, "Cannot unshare test file: " + error);
                assert.isNotNull(result, "Result is empty");
                assert.isTrue(result.isShareable, "MyFile is not shareable");
                assert.isFalse(result.isPublic, "MyFile is public");
                assert.isNull(result.viewers, "Viewers  is not null");
                assert.isNotNull(result.editors, "Editors is null");
                assert.equal(result.editors.length, 1, "Editors is not 1 long");
                assert.equal(result.editors[0].toString(), userId2.toString(), "User doesn't match");
                assert.isTrue(result.canView(userId1), "View rights missing");
                assert.isTrue(result.canEdit(userId1), "Edit rights missing");
                assert.isTrue(result.canRemove(userId1), "Remove rights missing");
                assert.isTrue(result.canView(userId2), "Missing view rights");
                assert.isTrue(result.canEdit(userId2), "Missing edit rights");
                assert.isFalse(result.canRemove(userId2), "Bogus remove rights");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("Shares a file to an existing editor", function (done) {
        fileService.shareFile(testFileId, true, true, null, [userId2], function (error, result) {
            try {
                assert.isNull(error, "Cannot unshare test file: " + error);
                assert.isNotNull(result, "Result is empty");
                assert.isTrue(result.isShareable, "MyFile is not shareable");
                assert.isTrue(result.isPublic, "MyFile is not public");
                assert.isNull(result.viewers, "Viewers  is not null");
                assert.isNotNull(result.editors, "Editors is null");
                assert.equal(result.editors.length, 1, "Editors is not 1 long");
                assert.equal(result.editors[0].toString(), userId2.toString(), "User doesn't match");
                assert.isTrue(result.canView(userId1), "View rights missing");
                assert.isTrue(result.canEdit(userId1), "Edit rights missing");
                assert.isTrue(result.canRemove(userId1), "Remove rights missing");
                assert.isTrue(result.canView(userId2), "Missing view rights");
                assert.isTrue(result.canEdit(userId2), "Missing edit rights");
                assert.isFalse(result.canRemove(userId2), "Bogus remove rights");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("Shares a file to both viewer and editor", function (done) {
        fileService.shareFile(testFileId, true, true, [userId2, userId2, userId2], [userId2, userId2, userId2], function (error, result) {
            try {
                assert.isNull(error, "Cannot unshare test file: " + error);
                assert.isNotNull(result, "Result is empty");
                assert.isTrue(result.isShareable, "MyFile is not shareable");
                assert.isTrue(result.isPublic, "MyFile is not public");
                assert.isNull(result.viewers, "Viewers  is not null");
                assert.isNotNull(result.editors, "Editors is null");
                assert.equal(result.editors.length, 1, "Editors is not 1 long");
                assert.equal(result.editors[0].toString(), userId2.toString(), "User doesn't match");
                assert.isTrue(result.canView(userId1), "View rights missing");
                assert.isTrue(result.canEdit(userId1), "Edit rights missing");
                assert.isTrue(result.canRemove(userId1), "Remove rights missing");
                assert.isTrue(result.canView(userId2), "Missing view rights");
                assert.isTrue(result.canEdit(userId2), "Missing edit rights");
                assert.isFalse(result.canRemove(userId2), "Bogus remove rights");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("Unshares a file from all editors and viewers and makes it public", function (done) {
        fileService.shareFile(testFileId, true, true, null, null, function (error, result) {
            try {
                assert.isNull(error, "Cannot unshare test file: " + error);
                assert.isNotNull(result, "Result is empty");
                assert.isTrue(result.isShareable, "MyFile is not shareable");
                assert.isTrue(result.isPublic, "MyFile is not public");
                assert.isNull(result.editors, "Editors is not null");
                assert.isNull(result.viewers, "Viewers is not null");
                assert.isTrue(result.canView(userId1), "View rights missing");
                assert.isTrue(result.canEdit(userId1), "Edit rights missing");
                assert.isTrue(result.canRemove(userId1), "Remove rights missing");
                assert.isTrue(result.canView(userId2), "Missing view rights");
                assert.isFalse(result.canEdit(userId2), "Bogus edit rights");
                assert.isFalse(result.canRemove(userId2), "Bogus remove rights");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("Unshares a file from all editors and viewers and makes it non-public, with share-through-link", function (done) {
        fileService.shareFile(testFileId, true, false, null, null, function (error, result) {
            try {
                assert.isNull(error, "Cannot unshare test file: " + error);
                assert.isNotNull(result, "Result is empty");
                assert.isTrue(result.isShareable, "MyFile is not shareable");
                assert.isFalse(result.isPublic, "MyFile is public");
                assert.isNull(result.editors, "Editors is not null");
                assert.isNull(result.viewers, "Viewers is not null");
                assert.isTrue(result.canView(userId1), "View rights missing");
                assert.isTrue(result.canEdit(userId1), "Edit rights missing");
                assert.isTrue(result.canRemove(userId1), "Remove rights missing");
                assert.isTrue(result.canView(userId2), "Missing view rights");
                assert.isFalse(result.canEdit(userId2), "Bogus edit rights");
                assert.isFalse(result.canRemove(userId2), "Bogus remove rights");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("Unshares a file from all editors and viewers and makes it non-public, without share-through-link", function (done) {
        fileService.shareFile(testFileId, false, false, null, null, function (error, result) {
            try {
                assert.isNull(error, "Cannot unshare test file: " + error);
                assert.isNotNull(result, "Result is empty");
                assert.isFalse(result.isShareable, "MyFile is shareable");
                assert.isFalse(result.isPublic, "MyFile is public");
                assert.isNull(result.editors, "Editors is not null");
                assert.isNull(result.viewers, "Viewers is not null");
                assert.isTrue(result.canView(userId1), "View rights missing");
                assert.isTrue(result.canEdit(userId1), "Edit rights missing");
                assert.isTrue(result.canRemove(userId1), "Remove rights missing");
                assert.isFalse(result.canView(userId2), "Bogus view rights");
                assert.isFalse(result.canEdit(userId2), "Bogus edit rights");
                assert.isFalse(result.canRemove(userId2), "Bogus remove rights");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    it("Tries to unshare non-existing file", function (done) {
        fileService.shareFile("00000000-0000-0000-0000-000000000000", true, true, null, null, function (error, result) {
            try {
                assert.isNotNull(error, "Should fail");
                assert.isNotNull(result, "Result is not empty");
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
                assert.isNull(error, "Cannot delete test file: " + error);
                assert.equal(result, 'OK', "Result is empty");
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


describe('MyFile taging', function () {
    var user;
    var fileId1;
    var fileId2;
    before(function (done) {
        userService.createUser("FileTagTest:ID", "Test MyFile Tag ", "test@Filetag.com", "Test MyFile Tag Avatar ", function (error, result) {
            if (error) console.error(error.message);
            user = result;
            done();
        });
    });
    before(function (done) {
        fileService.createNewVersion(user.id, "FileTagText", true, false, null, null, null, "MyFile tagging content", function (error, result) {
            if (error) console.error(error.message);
            fileId1 = result.id;
            done();
        });
    });
    before(function (done) {
        fileService.createNewVersion(user.id, "FileTagText2", true, false, null, null, ['TAG-TEST1', 'TAG-TEST2', 'TAG-TEST3', 'TAG-TEST4'], "MyFile tagging content2", function (error, result) {
            if (error) console.error(error.message);
            fileId2 = result.id;
            done();
        });
    });
    it("tags a MyFile with new tag", function (done) {
        fileService.tagFile(fileId1, 'TAG-TEST1', function (error, result) {
            try {
                assert.isNull(error);
                assert.isNotNull(result.tags);
                assert.equal(1, result.tags.length);
                assert.notEqual(-1, result.tags.indexOf('TAG-TEST1'));
                done();
            } catch (e) {
                done(e);
            }
        })
    });
    it("tags a MyFile with new tag 2", function (done) {
        fileService.tagFile(fileId1, 'TAG-TEST2', function (error, result) {
            try {
                assert.isNull(error);
                assert.isNotNull(result.tags);
                assert.equal(2, result.tags.length);
                assert.notEqual(-1, result.tags.indexOf('TAG-TEST1'));
                assert.notEqual(-1, result.tags.indexOf('TAG-TEST2'));
                done();
            } catch (e) {
                done(e);
            }
        });
    });
    it("tags a MyFile with existing tag", function (done) {
        fileService.tagFile(fileId1, 'TAG-TEST1', function (error, result) {
            try {
                assert.isNull(error);
                assert.isNotNull(result.tags);
                assert.equal(2, result.tags.length);
                assert.notEqual(-1, result.tags.indexOf('TAG-TEST1'));
                assert.notEqual(-1, result.tags.indexOf('TAG-TEST2'));
                done();
            } catch (e) {
                done(e);
            }
        });
    });
    it("Full query tags with existing tag and no file", function (done) {
        fileService.tagQuery(user.id, null, 'TAG-TEST1', function (error, result) {
            try {
                assert.isNull(error);
                assert.isNotNull(result);
                assert.equal(1, result.length);
                assert.notEqual(-1, result.indexOf('TAG-TEST1'));
                assert.equal(-1, result.indexOf('TAG-TEST2'));
                done();
            } catch (e) {
                done(e);
            }
        });
    });
    it("Full query tags with existing tag and file", function (done) {
        fileService.tagQuery(user.id, fileId1, 'TAG-TEST1', function (error, result) {
            try {
                assert.isNull(error);
                assert.isNotNull(result);
                assert.equal(1, result.length);
                assert.equal(0, result.indexOf('TAG-TEST1'));
                done();
            } catch (e) {
                done(e);
            }
        });
    });
    it("Partial query tags with existing tag no file", function (done) {
        fileService.tagQuery(user.id, null, 'TAG-TEST', function (error, result) {
            try {
                assert.isNull(error);
                assert.isNotNull(result);
                assert.equal(5, result.length);
                assert.equal(0, result.indexOf('TAG-TEST'));
                assert.notEqual(-1, result.indexOf('TAG-TEST1'));
                assert.notEqual(-1, result.indexOf('TAG-TEST2'));
                assert.notEqual(-1, result.indexOf('TAG-TEST3'));
                assert.notEqual(-1, result.indexOf('TAG-TEST4'));
                done();
            } catch (e) {
                done(e);
            }
        });
    });
    it("Partial query tags with existing tag and file", function (done) {
        fileService.tagQuery(user.id, fileId1, 'TAG-TEST', function (error, result) {
            try {
                assert.isNull(error);
                assert.isNotNull(result);
                assert.equal(3, result.length);
                assert.equal(0, result.indexOf('TAG-TEST'));
                assert.notEqual(-1, result.indexOf('TAG-TEST3'));
                assert.notEqual(-1, result.indexOf('TAG-TEST4'));
                done();
            } catch (e) {
                done(e);
            }
        });
    });
    it("removes existing tag", function (done) {
        fileService.untagFile(fileId1, 'TAG-TEST1', function (error, result) {
            try {
                assert.isNull(error);
                assert.isNotNull(result.tags);
                assert.equal(1, result.tags.length);
                assert.equal(-1, result.tags.indexOf('TAG-TEST1'));
                assert.notEqual(-1, result.tags.indexOf('TAG-TEST2'));
                done();
            } catch (e) {
                done(e);
            }
        });
    });
    it("removes missing tag", function (done) {
        fileService.untagFile(fileId1, 'TAG-TEST1', function (error, result) {
            try {
                assert.isNull(error);
                assert.isNotNull(result.tags);
                assert.equal(1, result.tags.length);
                assert.equal(-1, result.tags.indexOf('TAG-TEST1'));
                assert.notEqual(-1, result.tags.indexOf('TAG-TEST2'));
                done();
            } catch (e) {
                done(e);
            }
        });
    });
    it("tags invalid MyFile", function (done) {
        fileService.tagFile('00000000-0000-0000-0000-000000000000', 'TAG-TEST1', function (error, result) {
            try {
                assert.isNotNull(error);
                assert.isUndefined(result);
                done();
            } catch (e) {
                done(e);
            }
        });
    });
    it("untags invalid MyFile", function (done) {
        fileService.tagFile('00000000-0000-0000-0000-000000000000', 'TAG-TEST1', function (error, result) {
            try {
                assert.isNotNull(error);
                assert.isUndefined(result);
                done();
            } catch (e) {
                done(e);
            }
        });
    });
    after(function (done) {
        userService.deleteUser(user.id, function (error) {
            if (error) console.error(error);
            done();
        });
    });
});