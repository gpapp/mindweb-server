import * as async from 'async';
import * as cassandra from 'cassandra-driver';

import {Friend} from "mindweb-request-classes";
import {User} from "mindweb-request-classes";
import {ServiceError} from "mindweb-request-classes";

import FriendDAO from '../dao/FriendDAO';
import UserService from "./UserService";


export default class FriendService {
    private connection;
    private _friend:FriendDAO;
    private _userService:UserService;

    constructor(connection) {
        this.connection = connection
    }

    get userService():UserService {
        if (this._userService == null) {
            this._userService = new UserService(this.connection);
        }
        return this._userService;
    }

    get friend():FriendDAO {
        if (this._friend == null) {
            this._friend = new FriendDAO(this.connection);
        }
        return this._friend;
    }

    public getFriendById(id:string|cassandra.types.Uuid, callback:(error:ServiceError, friend?:Friend)=>void) {
        this.friend.getFriendById(id, (error:ServiceError, result:cassandra.types.ResultSet) => {
            if (error) return callback(error);
            if (result.rows.length == 0) {
                return callback(new ServiceError(500, 'Cannot find friend', 'Error in friend lookup'));
            }
            var row = result.first();
            callback(null, new Friend(row['id'], row['owner'], row['alias'], row['linked_user'], row['tags'], row['created'], row['modified']));
        });
    }

    public getFriends(userId:string|cassandra.types.Uuid, callback:(error:ServiceError, friends?:Friend[])=>void) {
        this.friend.getFriends(userId, (error:ServiceError, result:cassandra.types.ResultSet) => {
            if (error) return callback(error);
            var retval:Friend[] = [];
            for (var i = 0; i < result.rows.length; i++) {
                var row = result.rows[i];
                retval.push(new Friend(row['id'], row['owner'], row['alias'], row['linked_user'], row['tags'], row['created'], row['modified']));
            }
            callback(null, retval);
        });
    }

    public getFriendOfList(userId:string|cassandra.types.Uuid, callback:(error:ServiceError, friends?:Friend[])=>void) {
        this.friend.getFriendOfList(userId, (error:ServiceError, result:cassandra.types.ResultSet) => {
            if (error) return callback(error);
            var retval:Friend[] = [];
            for (var i = 0; i < result.rows.length; i++) {
                var row = result.rows[i];
                retval.push(new Friend(row['id'], row['owner'], row['alias'], row['linked_user'], row['tags'], row['created'], row['modified']));
            }
            callback(null, retval);
        });
    }

    public deleteFriend(id:string|cassandra.types.Uuid, callback:(error?:ServiceError)=>void) {
        var parent = this;
        async.waterfall([
            (next) => {
                parent.friend.deleteFriend(id, (error:ServiceError, result:cassandra.types.ResultSet) => {
                    if (error) return callback(error);
                    callback();
                })
            }]);
    }

    public createFriend(userId:string|cassandra.types.Uuid, alias:string, linkedUserId:string|cassandra.types.Uuid, tags:string[],
                        callback:(error:ServiceError, friend?:Friend)=>void) {
        if (userId.toString() === linkedUserId.toString()) {
            return callback(new ServiceError(500, 'You cannot befriend yoursef', 'Error in friend creation'));
        }
        var parent = this;
        async.waterfall([
            function (next:()=>void) {
                parent.friend.getExactFriendById(userId, linkedUserId, (error:ServiceError, result:cassandra.types.ResultSet) => {
                    if (error) return callback(error);
                    if (result.rows.length > 0) {
                        var row = result.first();
                        parent.friend.updateFriend(row['id'], alias, tags, (error:ServiceError, result:cassandra.types.ResultSet) => {
                            if (error) return callback(error);
                            parent.getFriendById(row['id'], callback);
                        });
                        return;
                    }
                    next();
                })
            },
            function (next:()=>void) {
                parent.friend.getExactFriendByAlias(userId, alias, (error:ServiceError, result:cassandra.types.ResultSet) => {
                    if (error) return callback(error);
                    if (result.rows.length > 0) {
                        var row = result.first();
                        return callback(new ServiceError(500, 'Alias already exists ' + alias, 'Error in friend creation'),
                            new Friend(row['id'], row['owner'], row['alias'], row['linked_user'], row['tags'], row['created'], row['modified']));
                    }
                    next();
                })
            },
            function (next:(error:ServiceError, user?:User)=>void) {
                parent.userService.getUserById(userId, (error, user:User) => {
                    if (error) return callback(error);
                    next(null, user);
                })
            }, function (user:User, next:(error:ServiceError, user?:User, linkedUser?:User)=>void) {
                parent.userService.getUserById(linkedUserId, (error, linkedUser:User) => {
                    if (error) return callback(error);
                    next(null, user, linkedUser);
                })
            }, (user:User, linkedUser:User) => {
                var newId:cassandra.types.Uuid = cassandra.types.Uuid.random();
                parent.friend.createFriend(newId, userId, alias, linkedUserId, tags, (error:ServiceError, result:cassandra.types.ResultSet) => {
                    if (error) return callback(error);
                    parent.getFriendById(newId, callback);
                });
            },
        ]);
    }


    //TODO NEW: Add unit test
    public updateFriend(friendId:string|cassandra.types.Uuid, alias:string, tags:string[],
                        callback:(error:ServiceError, friend?:Friend)=>void) {
        var parent = this;
        async.waterfall([
            function (next:(error:ServiceError, friend?:Friend)=>void) {
                parent.getFriendById(friendId, (error:ServiceError, result:Friend) => {
                    if (error) return callback(error);
                    next(null, result)
                })
            },
            function (friend:Friend, next:(error:ServiceError, friend?:Friend)=>void) {
                parent.friend.getExactFriendByAlias(friend.owner, alias, (error:ServiceError, result:cassandra.types.ResultSet) => {
                    if (error) return callback(error);
                    if (result.rows.length > 0) {
                        var row = result.first();
                        return callback(new ServiceError(500, 'Alias already exists ' + alias, 'Error in update'),
                            new Friend(row['id'], row['owner'], row['alias'], row['linked_user'], row['tags'], row['created'], row['modified']));
                    }
                    next(null, friend);
                })
            },
            (friend:Friend) => {
                parent.friend.updateFriend(friendId, alias, tags, (error:ServiceError, result:cassandra.types.ResultSet) => {
                    if (error) return callback(error);
                    parent.getFriendById(friendId, callback);
                })
            }
        ]);
    }

    public tagFriend(friendId:string|cassandra.types.Uuid, tag:string, callback:(error:ServiceError, friend?:Friend)=>void) {
        var parent = this;
        async.waterfall([
            function (next:(error:ServiceError, friend?:Friend)=>void) {
                parent.getFriendById(friendId, (error:ServiceError, result:Friend) => {
                        if (error) return callback(error);
                        next(null, result)
                    }
                )
            },
            (friend:Friend) => {
                if (tag == null) {
                    return callback(new ServiceError(500, 'Cannot add null tag', 'Error friend tagging'));
                }
                var tags;
                if (friend.tags == null) {
                    tags = [tag];
                } else {
                    tags = [tag].concat(friend.tags).filter((value, index, array) => {
                        return array.indexOf(value) == index;
                    });
                }
                parent.friend.updateFriend(friendId, friend.alias, tags, (error:ServiceError, result:cassandra.types.ResultSet) => {
                    if (error) return callback(error);
                    parent.getFriendById(friendId, callback);
                })
            }
        ]);
    }

    public untagFriend(friendId:string|cassandra.types.Uuid, tag:string, callback:(error:ServiceError, friend?:Friend)=>void) {
        var parent = this;
        async.waterfall([
            function (next:(error:ServiceError, friend?:Friend)=>void) {
                parent.getFriendById(friendId, (error:ServiceError, result:Friend) => {
                        if (error) return callback(error);
                        next(null, result)
                    }
                )
            },
            (friend:Friend) => {
                if (tag == null) {
                    return callback(new ServiceError(500, 'Cannot remove null tag', 'Error friend untagging'));
                }
                var tags = friend.tags.filter((value, index, array) => {
                    return (array.indexOf(value) == index && value != tag);
                });
                parent.friend.updateFriend(friendId, friend.alias, tags, (error:ServiceError, result:cassandra.types.ResultSet) => {
                    if (error) return callback(error);
                    parent.getFriendById(friendId, callback);
                })
            }
        ]);
    }
}