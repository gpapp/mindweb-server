import async from 'async';

import FileService from './FileService';
import User from '../classes/User';
import UserDAO from '../dao/User';

var Uuid = require('cassandra-driver').types.Uuid;

export default class UserService {

    constructor(connection) {
        this.user = new UserDAO(connection);
        this.fileService = new FileService(connection);
    }

    getUserByAuthId(authId, next) {
        this.user.getUserByAuthId(authId, function (error, result) {
            if (error) {
                return next(error, null);
            }
            if (result.rows.length == 0) {
                return next(null, null);
            }
            var row = result.first();
            next(null, new User(row['id'], row['name'], row['authId'], row['avatarurl'], row['created'], row['modified']));
        });
    }

    getUserById(id, next) {
        this.user.getUserById(id, function (error, result) {
            if (error) {
                return next(error, null);
            }
            if (result.rows.length == 0) {
                return next(new Error('Cannot find user:' + id));
            }
            var row = result.first();
            next(null, new User(row['id'], row['name'], row['authId'], row['avatarurl'], row['created'], row['modified']));
        });
    }

    createUser(authId, name, avatarUrl, next) {
        var parent = this;
        this.getUserByAuthId(authId, function (error, result) {
            if (error) {
                return next(error);}
            if (result==null){
                var userId = Uuid.random();
                parent.user.createUser(userId, authId, name, avatarUrl, function (error) {
                    if (error) {
                        console.error(error);
                        return next(error, null);
                    }
                    next(null, {userId: userId});
                });
            }
            else {
                console.error("User already exists with authid: " + authId);
                next("User already exists with authid: " + authId);
            }
        });
    }

    deleteUser(userId, callback) {
        var fileDAOLocal = this.fileService;
        var userLocal = this.user;
        this.fileService.getFiles(userId, function (error, result) {
            if (error) {
                return callback(error);
            }
            async.each(result.rows, function (rec, eachNext) {
                fileDAOLocal.deleteFile(rec.id, eachNext);
            }, function (error) {
                if (error) {
                    return callback(error);
                }
                userLocal.deleteUser(userId, callback);
            });
        });
    }
}