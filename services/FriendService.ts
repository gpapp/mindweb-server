import * as async from 'async';
import * as cassandra from 'cassandra-driver';

import Friend from '../classes/Friend';
import User from '../classes/User';
import ServiceError from "../classes/ServiceError";

import FriendDAO from '../dao/Friend';
import UserService from "./UserService";

var Uuid = require('cassandra-driver').types.Uuid;

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

    public getFriendById(id:string|cassandra.types.Uuid, callback:Function) {
        this.friend.getFriendById(id, function (error, result) {
            if (error) return callback(error);
            if (result.rows.length == 0) {
                return callback(new ServiceError(500, 'Cannot find friend', 'Error in friend lookup'));
            }
            var row = result.first();
            callback(null, new Friend(row['id'], row['owner'], row['alias'], row['linked_user'], row['created'], row['modified']));
        });
    }

    public getFriends(userId:string|cassandra.types.Uuid, callback:Function) {
        this.friend.getFriends(userId, function (error, result) {
            if (error) return callback(error);
            var retval:Friend[] = [];
            for (var i = 0; i < result.rows.length; i++) {
                var row = result.rows[i];
                retval.push(new Friend(row['id'], row['owner'], row['alias'], row['linked_user'], row['created'], row['modified']));
            }
            callback(null, retval);
        });
    }

    public getFriendOfList(userId:string|cassandra.types.Uuid, callback:Function) {
        this.friend.getFriendOfList(userId, function (error, result) {
            if (error) return callback(error);
            var retval:Friend[] = [];
            for (var i = 0; i < result.rows.length; i++) {
                var row = result.rows[i];
                retval.push(new Friend(row['id'], row['owner'], row['alias'], row['linked_user'], row['created'], row['modified']));
            }
            callback(null, retval);
        });
    }

    public deleteFriend(id:string|cassandra.types.Uuid, callback:Function) {
        var parent = this;
        async.waterfall([
            function (next) {
                parent.friend.deleteFriend(id, function (error, result) {
                    if (error) return callback(error);
                    callback();
                })
            }]);
    }

    public createFriend(userId:string|cassandra.types.Uuid, alias:string, linkedUserId:string|cassandra.types.Uuid, callback:Function) {
        if (userId.toString() === linkedUserId.toString()) {
            callback(new ServiceError(500, 'You cannot befriend yoursef', 'Error in friend creation'));
        }
        var parent = this;
        async.waterfall([
            function (next) {
                parent.friend.getExactFriendById(userId, linkedUserId, function (error, result) {
                    if (error) return callback(error);
                    if (result.rows.length > 0) {
                        callback(new ServiceError(500, 'Alias already exists', 'Error in friend creation'));
                    }
                    next();
                })
            },
            function (next) {
                parent.friend.getExactFriendByAlias(userId, alias, function (error, result) {
                    if (error) return callback(error);
                    if (result.rows.length > 0) {
                        callback(new ServiceError(500, 'Alias already exists', 'Error in friend creation'));
                    }
                    next();
                })
            },
            function (next) {
                parent.userService.getUserById(userId, function (error, user:User) {
                    if (error) return callback(error);
                    next(null, user);
                })
            }, function (user:User, next) {
                parent.userService.getUserById(linkedUserId, function (error, linkedUser:User) {
                    if (error) return callback(error);
                    next(null, user, linkedUser);
                })
            }, function (user, linkedUser, next) {
                var newId = Uuid.random();
                parent.friend.createFriend(newId, userId, alias, linkedUserId, function (error, result) {
                    parent.getFriendById(newId, callback);
                });
            },
        ]);
    }
}