import {assert} from "chai";
import * as app from "../../app";
import * as async from "async";
import Friend from "../../classes/Friend";
import FriendService from "../../services/FriendService";
import UserService from "../../services/UserService";
import ServiceError from "map-editor/dist/classes/ServiceError";

let userService: UserService;
let friendService: FriendService;

before(function (next) {
    app.initialize(next);
});
before(function (next) {
    userService = new UserService(app.cassandraClient);
    friendService = new FriendService(app.cassandraClient);
    next();
});


describe('Friend management', function () {
    var users = [];
    var friendIds = [];
    var createdUsers = 2;
    var timeout = 1000;
    before(function (done) {
        this.timeout(createdUsers * timeout);
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
        this.timeout(createdUsers * timeout);
        var i = 1;
        async.whilst(function () {
            return i < createdUsers;
        }, function (next) {
            friendService.createFriend(users[0].id, "Alias 0-" + i, users[i].id, ['tag1', 'tag2'], function (error, result: Friend) {
                try {
                    assert.isNull(error);
                    friendIds.push(result.id);
                    assert.equal(result.owner.toString(), users[0].id.toString(), 'Owner mismatch');
                    assert.equal(result.linkedUser.toString(), users[i].id.toString(), 'Linkeduser mismatch');
                    assert.equal(result.alias, "Alias 0-" + i, 'Alias mismatch');
                    assert.equal(2, result.tags.length);
                    assert.notEqual(-1, result.tags.indexOf('tag1'));
                    assert.notEqual(-1, result.tags.indexOf('tag2'));
                    i++;
                    next();
                } catch (e) {
                    done(e);
                }
            });
        }, function (error) {
            done(error);
        });
    });
    it("creates an existing friend", function (done) {
        this.timeout(createdUsers * timeout);
        var i = 1;
        async.whilst(function () {
            return i < createdUsers;
        }, function (next) {
            friendService.createFriend(users[0].id, "Alias 0-" + i, users[i].id, ['tag3', 'tag4', 'tag5'], function (error, result: Friend) {
                try {
                    assert.isNull(error);
                    assert.equal(result.owner.toString(), users[0].id.toString(), 'Owner mismatch');
                    assert.equal(result.linkedUser.toString(), users[i].id.toString(), 'Linkeduser mismatch');
                    assert.equal(result.alias, "Alias 0-" + i, 'Alias mismatch');
                    assert.equal(3, result.tags.length);
                    assert.notEqual(-1, result.tags.indexOf('tag3'));
                    assert.notEqual(-1, result.tags.indexOf('tag4'));
                    assert.notEqual(-1, result.tags.indexOf('tag5'));
                    i++;
                    next();
                } catch (e) {
                    done(e);
                }

            });
        }, function () {
            done();
        });
    });
    it("removes friend", function (done) {
        this.timeout(createdUsers * timeout);
        var i = 0;
        async.whilst(function () {
            return i < createdUsers - 1;
        }, function (next) {
            friendService.deleteFriend(friendIds[i], function (error: ServiceError) {
                try {
                    if (error) return done(error);
                    assert.isUndefined(error);
                    i++;
                    next();
                } catch (e) {
                    done(e);
                }
            });
        }, function () {
            done();
        });
    });
    after(function (done) {
        this.timeout(createdUsers * timeout);
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

describe('Friend taging', function () {
    var users = [];
    var friendIds = [];
    var createdFriends = 10;
    var timeout = 1000;
    before(function (done) {
        this.timeout(createdFriends * timeout);
        var i = 0;
        async.whilst(function () {
                return i < createdFriends + 1;
            },
            function (next) {
                userService.createUser("friendTagTest:ID" + i, "Test Friend Tag " + i, "test" + i + "@friendtag.com", "Test Friend Tag Avatar " + i, function (error, result) {
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
    before(function (done) {
        this.timeout(createdFriends * timeout);
        var i = 1;
        async.whilst(function () {
            return i < createdFriends + 1;
        }, function (next) {
            friendService.createFriend(users[0].id, "Alias 0-" + i, users[i].id, null, function (error, result) {
                if (error) console.error(error.message);
                friendIds.push(result.id);
                i++;
                next();
            });
        }, function () {
            done();
        });
    });
    it("tags a friend with new tag", function (done) {
        this.timeout(createdFriends * timeout);
        var i = 0;
        async.whilst(function () {
            return i < createdFriends;
        }, function (next) {
            friendService.tagFriend(friendIds[i], 'TAG-TEST1', function (error, result) {
                try {
                    assert.isNull(error);
                    assert.isNotNull(result.tags);
                    assert.equal(1, result.tags.length);
                    assert.notEqual(-1, result.tags.indexOf('TAG-TEST1'));
                    i++;
                    next();
                } catch (e) {
                    done(e);
                }
            });
        }, function () {
            done();
        });
    });
    it("tags a friend with new tag 2", function (done) {
        this.timeout(createdFriends * timeout);
        var i = 0;
        async.whilst(function () {
            return i < createdFriends;
        }, function (next) {
            friendService.tagFriend(friendIds[i], 'TAG-TEST2', function (error, result) {
                try {
                    assert.isNull(error);
                    assert.isNotNull(result.tags);
                    assert.equal(2, result.tags.length);
                    assert.notEqual(-1, result.tags.indexOf('TAG-TEST1'));
                    assert.notEqual(-1, result.tags.indexOf('TAG-TEST2'));
                    i++;
                    next();
                } catch (e) {
                    done(e);
                }
            });
        }, function () {
            done();
        });
    });
    it("tags a friend with existing tag", function (done) {
        this.timeout(createdFriends * timeout);
        var i = 0;
        async.whilst(function () {
            return i < createdFriends;
        }, function (next) {
            friendService.tagFriend(friendIds[i], 'TAG-TEST1', function (error, result) {
                try {
                    assert.isNull(error);
                    assert.isNotNull(result.tags);
                    assert.equal(2, result.tags.length);
                    assert.notEqual(-1, result.tags.indexOf('TAG-TEST1'));
                    assert.notEqual(-1, result.tags.indexOf('TAG-TEST2'));
                    i++;
                    next();
                } catch (e) {
                    done(e);
                }
            });
        }, function () {
            done();
        });
    });
    it("removes existing tag", function (done) {
        this.timeout(createdFriends * timeout);
        var i = 0;
        async.whilst(function () {
            return i < createdFriends;
        }, function (next) {
            friendService.untagFriend(friendIds[i], 'TAG-TEST1', function (error, result) {
                try {
                    assert.isNull(error);
                    assert.isNotNull(result.tags);
                    assert.equal(1, result.tags.length);
                    assert.equal(-1, result.tags.indexOf('TAG-TEST1'));
                    assert.notEqual(-1, result.tags.indexOf('TAG-TEST2'));
                    i++;
                    next();
                } catch (e) {
                    done(e);
                }
            });
        }, function () {
            done();
        });
    });
    it("removes missing tag", function (done) {
        this.timeout(createdFriends * timeout);
        var i = 0;
        async.whilst(function () {
            return i < createdFriends;
        }, function (next) {
            friendService.untagFriend(friendIds[i], 'TAG-TEST1', function (error, result) {
                try {
                    assert.isNull(error);
                    assert.isNotNull(result.tags);
                    assert.equal(1, result.tags.length);
                    assert.equal(-1, result.tags.indexOf('TAG-TEST1'));
                    assert.notEqual(-1, result.tags.indexOf('TAG-TEST2'));
                    i++;
                    next();
                } catch (e) {
                    done(e);
                }
            });
        }, function () {
            done();
        });
    });
    it("tags invalid friend", function (done) {
        friendService.tagFriend('00000000-0000-0000-0000-000000000000', 'TAG-TEST1', function (error, result) {
            try {
                assert.isNotNull(error);
                assert.isUndefined(result);
                done();
            } catch (e) {
                done(e);
            }
        });
    });
    it("untags invalid friend", function (done) {
        friendService.tagFriend('00000000-0000-0000-0000-000000000000', 'TAG-TEST1', function (error, result) {
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
        this.timeout(createdFriends * timeout);
        var i = 0;
        async.whilst(function () {
            return i < createdFriends + 1;
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