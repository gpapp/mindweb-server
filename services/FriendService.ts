import * as async from 'async';
import * as cassandra from 'cassandra-driver';

import Friend from '../classes/Friend';
import User from '../classes/User';
import ServiceError from "../classes/ServiceError";

import FriendDAO from '../dao/Friend';

var Uuid = require('cassandra-driver').types.Uuid;

export default class FriendService {
    private frient:FriendDAO;

    constructor(connection) {
        this.user = new UserDAO(connection);
        this.fileService = new FileService(connection);
    }

    public getUserByAuthId(authId:string, next:Function) {
        this.user.getUserByAuthId(authId, function (error, result) {
            if (error) {
                return next(error, null);
            }
            if (result.rows.length == 0) {
                return next(null, null);
            }
            var row = result.first();
            next(null, new User(row['id'], row['persona'], row['name'], row['email'], row['avatarurl'], row['created'], row['modified']));
        });
    }

    public getUserById(id:string|cassandra.types.Uuid, next:Function) {
        this.user.getUserById(id, function (error, result) {
            if (error) {
                return next(error);
            }
            if (result.rows.length == 0) {
                return next(new Error('Cannot find user:' + id));
            }
            var row = result.first();
            next(null, new User(row['id'], row['persona'], row['name'], row['email'], row['avatarurl'], row['created'], row['modified']));
        });
    }

    public createUser(authId:string, name:string, email:string, avatarUrl:string, next:Function) {
        var parent = this;
        this.getUserByAuthId(authId, function (error, result:User) {
            if (error) {
                return next(error);
            }
            if (result == null) {
                var userId = Uuid.random();
                parent.user.createPersona(authId, name, email, avatarUrl, function (error, result) {
                    if (error) {
                        return next(error);
                    }
                    parent.user.createUser(userId, [authId], name, email, avatarUrl, function (error) {
                        if (error) {
                            console.error(error);
                            return next(error);
                        }
                        parent.getUserByAuthId(authId, function (error, result:User) {
                            next(null, result);
                        });
                    });
                });
            }
            else {
                console.error("User already exists with authid: " + authId);
                next(new ServiceError(500, "User already exists with authid: " + authId, "User creation error"), result);
            }
        });
    }

    public deleteUser(userId:string|cassandra.types.Uuid, callback:Function) {
        var parent = this;
        var fileDAOLocal = this.fileService;
        var userLocal = this.user;
        this.fileService.getFiles(userId, function (error, result:File[]) {
            if (error) {
                return callback(error);
            }
            async.each(result, function (rec:File, eachNext) {
                fileDAOLocal.deleteFile(rec.id, eachNext);
            }, function (error) {
                if (error) {
                    return callback(error);
                }
                parent.getUserById(userId, function (error, result) {
                    if (error) {
                        return callback(error);
                    }
                    async.each(result.persona, function (personaId:string, eachNext) {
                        userLocal.deletePersona(personaId, eachNext);
                    }, function (error) {
                        userLocal.deleteUser(userId, function (error, result) {
                            if (error) {
                                return callback(error);
                            }
                            callback();
                        });
                    });
                })
            });
        });
    }

    public addPersona(userId:string|cassandra.types.Uuid, authId:string, name:string, email:string, avatarUrl:string, callback:Function) {
        var parent = this;
        async.waterfall([
            function (next) {
                // check if persona already exists
                parent.getUserByAuthId(authId, function (error, user:User) {
                    if (error) return callback(error);
                    if (user == null) {
                        parent.getUserById(userId, function (error, user) {
                            next(error, user, false);
                        });
                        return;
                    }
                    if (userId.toString() != user.id.toString()) {
                        return callback(new ServiceError(500, 'Persona already associated to another user', 'Add persona error'));
                    }
                    // check to see if the persona already exists
                    var isUpdate = false;
                    for (var i in user.persona) {
                        if (user.persona[i] === authId) {
                            isUpdate = true;
                            break;
                        }
                    }
                    next(null, user, isUpdate);
                });
            },
            function (user:User, isUpdate:boolean, next:Function) {
                if (isUpdate) {
                    parent.user.createPersona(authId, name, email, avatarUrl, function (error, result) {
                        if (error) return callback(error);
                        next(null, user, isUpdate);
                    });
                } else {
                    parent.user.createPersona(authId, name, email, avatarUrl, function (error, result) {
                        if (error) return callback(error);
                        next(null, user, isUpdate);
                    });
                }
            },
            function (user:User, isUpdate:boolean, next:Function) {
                if (!isUpdate) {
                    user.persona.push(authId);
                }
                parent.user.createUser(user.id, user.persona, user.name, user.email, user.avatarUrl, function (error, result) {
                    if (error) return callback(error);
                    return callback(null, user);
                });
            }
        ], function (error) {
            callback(error);
        });
    }

    public removePersona(userId:string|cassandra.types.Uuid, authId:string, callback:Function):void {
        var parent = this;
        async.waterfall([
            function (next) {
                // check if persona already exists
                parent.getUserByAuthId(authId, function (error, user:User) {
                    if (error) return callback(error);
                    if (user == null) {
                        return callback(new ServiceError(500, 'Persona not associated with any user', 'Remove persona error'));
                    }
                    if (userId.toString() != user.id.toString()) {
                        return callback(new ServiceError(500, 'Persona associated to another user', 'Remove persona error'));
                    }
                    if (user.persona.length == 1) {
                        return callback(new ServiceError(500, 'Cannot remove last persona', 'Remove persona error'));
                    }
                    for (var i in user.persona) {
                        if (user.persona[i] === authId) {
                            user.persona.splice(i, 1);
                            break;
                        }
                    }
                    next(null, user);
                });
            },
            function (user:User, next:Function) {
                parent.user.deletePersona(authId, function (error, result) {
                    if (error) return callback(error);
                    next(null, user);
                })
            },
            function (user:User, next:Function) {
                parent.user.createUser(user.id, user.persona, user.name, user.email, user.avatarUrl, function (error, result) {
                    if (error) return callback(error);
                    return callback(null, user);
                });
            }
        ], function (error) {
            callback(error);
        });
    }
}