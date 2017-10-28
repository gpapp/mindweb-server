import { before,describe, it, after } from "mocha";
import {assert} from "chai";
import * as app from "../../app";
import {MapContainer} from "mindweb-request-classes";
import FileService from "../../services/MapService";
import UserService from "../../services/UserService";

let userService: UserService;
let fileService: FileService;

before(function(next) {
    this.timeout(12000);
    app.initialize(next);
});
before((next) => {
    userService = new UserService(app.cassandraClient);
    fileService = new FileService(app.cassandraClient);
    next();
});


describe('MapContainerDAO mapDAO create', () => {
    let userId1;
    let userId2;
    let testFileId;
    before((next) => {
        userService.createUser("fileTest:ID1", "Test MapContainer User 1", "test1@mapDAO.com", "Test MapContainer Avatar 1", (error, result) => {
            if (error) {
                userService.getUserByAuthId("fileTest:ID1", (error, result) => {
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
    before((next) => {
        userService.createUser("fileTest:ID2", "Test MapContainer User 2", "test2@mapDAO.com", "Test MapContainer Avatar 2", (error, result) => {
            if (error) {
                userService.getUserByAuthId("fileTest:ID2", (error, result) => {
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
    it("creates a mapDAO in the database", (done) => {
        fileService.createNewVersion(userId1, "Test fajl 1", false, false, null, null, ['tag1', 'tag2'], "Test Content", (error, result: MapContainer) => {
            try {
                assert.isNull(error, "Cannot create test mapDAO: " + error);
                assert.isNotNull(result, "Result is empty");
                assert.isFalse(result.isShareable, "MapContainer is shareable");
                assert.isFalse(result.isPublic, "MapContainer is public");
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
    it("Saves a mapDAO with identical content (no new version)", (done) => {
        fileService.createNewVersion(userId1, "Test fajl 1", true, true, null, null, ['tag1', 'tag2'], "Test Content", (error, result: MapContainer) => {
            try {
                assert.isNull(error, "Cannot create test mapDAO: " + error);
                assert.isNotNull(result, "Result is empty");
                assert.equal(result.id.toString(), testFileId.toString(), "MapService ids mismatched");
                assert.isTrue(result.isShareable, "MapContainer is not shareable");
                assert.isTrue(result.isPublic, "MapContainer is not public");
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
    it("Saves a new version of a mapDAO with changed content (new version)", (done) => {
        fileService.createNewVersion(userId1, "Test fajl 1", true, true, null, null, ['tag1', 'tag2'], "Test Content changed", (error, result) => {
            try {
                assert.isNull(error, "Cannot create test mapDAO: " + error);
                assert.isNotNull(result, "Result is empty");
                assert.equal(result.id.toString(), testFileId.toString(), "MapService ids mismatched");
                assert.isTrue(result.isShareable, "MapContainer is not shareable");
                assert.isTrue(result.isPublic, "MapContainer is not public");
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
    it("Renames a mapDAO", (done) => {
        fileService.renameMap(testFileId, "Test fajl 1 (renamed)", (error, result: MapContainer) => {
            try {
                assert.isNull(error, "Cannot rename test mapDAO: " + error);
                assert.isNotNull(result, "Result is empty");
                assert.isTrue(result.isPublic, "MapContainer is not public");
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
    it("Shares a mapDAO publicly", (done) => {
        fileService.shareMap(testFileId, true, true, null, null, (error, result) => {
            try {
                assert.isNull(error, "Cannot share mapDAO: " + error);
                assert.isNotNull(result, "Result is empty");
                fileService.getMap(testFileId, (error, result: MapContainer) => {
                    assert.equal(result.id.toString(), testFileId.toString(), "Wrong mapDAO loaded");
                    assert.isTrue(result.isShareable, "MapContainer is not shareable");
                    assert.isTrue(result.isPublic, "MapContainer is not public");
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
    it("Unshares a mapDAO publicly with share-through-link", (done) => {
        fileService.shareMap(testFileId, true, false, null, null, (error, result) => {
            try {
                assert.isNull(error, "Cannot share mapDAO: " + error);
                assert.isNotNull(result, "Result is empty");
                assert.equal(result.id.toString(), testFileId.toString(), "Wrong mapDAO loaded");
                assert.isTrue(result.isShareable, "MapContainer is not shareable");
                assert.isFalse(result.isPublic, "MapContainer is public");
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
    it("Unshares a mapDAO publicly without share-through link", (done) => {
        fileService.shareMap(testFileId, false, false, null, null, (error, result) => {
            try {
                assert.isNull(error, "Cannot share mapDAO: " + error);
                assert.isNotNull(result, "Result is empty");
                assert.equal(result.id.toString(), testFileId.toString(), "Wrong mapDAO loaded");
                assert.isFalse(result.isShareable, "MapContainer is not shareable");
                assert.isFalse(result.isPublic, "MapContainer is public");
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
    it("Shares a mapDAO to a viewer", (done) => {
        fileService.shareMap(testFileId, true, false, [userId2], null, (error, result) => {
            try {
                assert.isNull(error, "Cannot unshare test mapDAO: " + error);
                assert.isNotNull(result, "Result is empty");
                assert.isTrue(result.isShareable, "MapContainer is not shareable");
                assert.isFalse(result.isPublic, "MapContainer is public");
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
    it("Shares a mapDAO to an existing viewer", (done) => {
        fileService.shareMap(testFileId, true, false, [userId2], null, (error, result) => {
            try {
                assert.isNull(error, "Cannot unshare test mapDAO: " + error);
                assert.isNotNull(result, "Result is empty");
                assert.isTrue(result.isShareable, "MapContainer is not shareable");
                assert.isFalse(result.isPublic, "MapContainer is public");
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
    it("Shares a mapDAO to an editor ", (done) => {
        fileService.shareMap(testFileId, true, false, null, [userId2], (error, result) => {
            try {
                assert.isNull(error, "Cannot unshare test mapDAO: " + error);
                assert.isNotNull(result, "Result is empty");
                assert.isTrue(result.isShareable, "MapContainer is not shareable");
                assert.isFalse(result.isPublic, "MapContainer is public");
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
    it("Shares a mapDAO to an existing editor", (done) => {
        fileService.shareMap(testFileId, true, true, null, [userId2], (error, result) => {
            try {
                assert.isNull(error, "Cannot unshare test mapDAO: " + error);
                assert.isNotNull(result, "Result is empty");
                assert.isTrue(result.isShareable, "MapContainer is not shareable");
                assert.isTrue(result.isPublic, "MapContainer is not public");
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
    it("Shares a mapDAO to both viewer and editor", (done) => {
        fileService.shareMap(testFileId, true, true, [userId2, userId2, userId2], [userId2, userId2, userId2], (error, result) => {
            try {
                assert.isNull(error, "Cannot unshare test mapDAO: " + error);
                assert.isNotNull(result, "Result is empty");
                assert.isTrue(result.isShareable, "MapContainer is not shareable");
                assert.isTrue(result.isPublic, "MapContainer is not public");
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
    it("Unshares a mapDAO from all editors and viewers and makes it public", (done) => {
        fileService.shareMap(testFileId, true, true, null, null, (error, result) => {
            try {
                assert.isNull(error, "Cannot unshare test mapDAO: " + error);
                assert.isNotNull(result, "Result is empty");
                assert.isTrue(result.isShareable, "MapContainer is not shareable");
                assert.isTrue(result.isPublic, "MapContainer is not public");
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
    it("Unshares a mapDAO from all editors and viewers and makes it non-public, with share-through-link", (done) => {
        fileService.shareMap(testFileId, true, false, null, null, (error, result) => {
            try {
                assert.isNull(error, "Cannot unshare test mapDAO: " + error);
                assert.isNotNull(result, "Result is empty");
                assert.isTrue(result.isShareable, "MapContainer is not shareable");
                assert.isFalse(result.isPublic, "MapContainer is public");
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
    it("Unshares a mapDAO from all editors and viewers and makes it non-public, without share-through-link", (done) => {
        fileService.shareMap(testFileId, false, false, null, null, (error, result) => {
            try {
                assert.isNull(error, "Cannot unshare test mapDAO: " + error);
                assert.isNotNull(result, "Result is empty");
                assert.isFalse(result.isShareable, "MapContainer is shareable");
                assert.isFalse(result.isPublic, "MapContainer is public");
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
    it("Tries to unshare non-existing mapDAO", (done) => {
        fileService.shareMap("00000000-0000-0000-0000-000000000000", true, true, null, null, (error, result) => {
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
    it("Deletes a mapDAO", (done) => {
        fileService.deleteMap(testFileId, (error, result) => {
            try {
                assert.isNull(error, "Cannot delete test mapDAO: " + error);
                assert.equal(result, 'OK', "Result is empty");
                done();
            }
            catch (e) {
                done(e);
            }
        });
    });
    after((next) => {
        userService.deleteUser(userId1, (error) => {
            if (error) {
                next(error);
            }
            console.log("User removed:" + userId1);
            next();
        });
    });
    after((next) => {
        userService.deleteUser(userId2, (error) => {
            if (error) {
                next(error);
            }
            console.log("User removed:" + userId2);
            next();
        });
    });
});


describe('MapContainer taging', () => {
    let user;
    let fileId1;
    let fileId2;
    before((done) => {
        userService.createUser("FileTagTest:ID", "Test MapContainer Tag ", "test@Filetag.com", "Test MapContainer Tag Avatar ", (error, result) => {
            if (error) console.error(error.message);
            user = result;
            done();
        });
    });
    before((done) => {
        fileService.createNewVersion(user.id, "FileTagText", true, false, null, null, null, "MapContainer tagging content", (error, result) => {
            if (error) console.error(error.message);
            fileId1 = result.id;
            done();
        });
    });
    before((done) => {
        fileService.createNewVersion(user.id, "FileTagText2", true, false, null, null, ['TAG-TEST1', 'TAG-TEST2', 'TAG-TEST3', 'TAG-TEST4'], "MapContainer tagging content2", (error, result) => {
            if (error) console.error(error.message);
            fileId2 = result.id;
            done();
        });
    });
    it("tags a MapContainer with new tag", (done) => {
        fileService.tagMap(fileId1, 'TAG-TEST1', (error, result) => {
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
    it("tags a MapContainer with new tag 2", (done) => {
        fileService.tagMap(fileId1, 'TAG-TEST2', (error, result) => {
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
    it("tags a MapContainer with existing tag", (done) => {
        fileService.tagMap(fileId1, 'TAG-TEST1', (error, result) => {
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
    it("Full query tags with existing tag and no mapDAO", (done) => {
        fileService.tagQuery(user.id, null, 'TAG-TEST1', (error, result) => {
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
    it("Full query tags with existing tag and mapDAO", (done) => {
        fileService.tagQuery(user.id, fileId1, 'TAG-TEST1', (error, result) => {
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
    it("Partial query tags with existing tag no mapDAO", (done) => {
        fileService.tagQuery(user.id, null, 'TAG-TEST', (error, result) => {
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
    it("Partial query tags with existing tag and mapDAO", (done) => {
        fileService.tagQuery(user.id, fileId1, 'TAG-TEST', (error, result) => {
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
    it("removes existing tag", (done) => {
        fileService.untagMap(fileId1, 'TAG-TEST1', (error, result) => {
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
    it("removes missing tag", (done) => {
        fileService.untagMap(fileId1, 'TAG-TEST1', (error, result) => {
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
    it("tags invalid MapContainer", (done) => {
        fileService.tagMap('00000000-0000-0000-0000-000000000000', 'TAG-TEST1', (error, result) => {
            try {
                assert.isNotNull(error);
                assert.isUndefined(result);
                done();
            } catch (e) {
                done(e);
            }
        });
    });
    it("untags invalid MapContainer", (done) => {
        fileService.tagMap('00000000-0000-0000-0000-000000000000', 'TAG-TEST1', (error, result) => {
            try {
                assert.isNotNull(error);
                assert.isUndefined(result);
                done();
            } catch (e) {
                done(e);
            }
        });
    });
    after((done) => {
        userService.deleteUser(user.id, (error) => {
            if (error) console.error(error);
            done();
        });
    });
});