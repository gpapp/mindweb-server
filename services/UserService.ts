import * as async from 'async';
import * as cassandra from 'cassandra-driver';

import File from '../classes/File';
import User from '../classes/User';
import Persona from '../classes/Persona';
import Friend from "../classes/Friend";
import ServiceError from "../classes/ServiceError";

import UserDAO from '../dao/User';
import UserPersonaDAO from '../dao/UserPersona';

import FileService from './FileService';
import FriendService from "./FriendService";

var Uuid = require('cassandra-driver').types.Uuid;

export default class UserService {
    private connection;
    private _user:UserDAO;
    private _persona:UserPersonaDAO;
    private _friendService:FriendService;
    private _fileService:FileService;

    constructor(connection) {
        this.connection = connection;
    }

    get user():UserDAO {
        if (this._user == null)
            this._user = new UserDAO(this.connection);
        return this._user;
    }

    get persona():UserPersonaDAO {
        if (this._persona == null)
            this._persona = new UserPersonaDAO(this.connection);
        return this._persona;
    }

    get friendService():FriendService {
        if (this._friendService == null)
            this._friendService = new FriendService(this.connection);
        return this._friendService;
    }

    get fileService():FileService {
        if (this._fileService == null)
            this._fileService = new FileService(this.connection);
        return this._fileService;
    }

    public getUserByAuthId(authId:string, next:(error:ServiceError, user?:User)=>void) {
        this.user.getUserByAuthId(authId, function (error:ServiceError, result:cassandra.ExecuteResult) {
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

    public getUserById(id:string|cassandra.types.Uuid, next:(error:ServiceError, user?:User)=>void) {
        this.user.getUserById(id, function (error:ServiceError, result:cassandra.ExecuteResult) {
            if (error) {
                return next(error);
            }
            if (result.rows.length == 0) {
                return next(new ServiceError(403, 'Cannot find user:' + id, 'getUserById'));
            }
            var row = result.first();
            next(null, new User(row['id'], row['persona'], row['name'], row['email'], row['avatarurl'], row['created'], row['modified']));
        });
    }

    public createUser(authId:string, name:string, email:string, avatarUrl:string, callback:(error:ServiceError, user?:User)=>void) {
        var parent = this;
        this.getUserByAuthId(authId, function (error, result:User) {
            if (error) return callback(error);
            if (result != null) {
                return callback(new ServiceError(500, "User already exists with authid: " + authId, "User creation error"), result);
            }
            var userId = Uuid.random();
            parent.persona.createPersona(authId, name, email, avatarUrl, function (error:ServiceError, result:cassandra.ExecuteResult) {
                if (error) return callback(error);
                parent.user.createUser(userId, [authId], name, email, avatarUrl, function (error) {
                    if (error) return callback(error);
                    parent.getUserByAuthId(authId, callback);
                });
            });
        });
    }

    public deleteUser(userId:string|cassandra.types.Uuid, callback:(error?:ServiceError)=>void) {
        var parent = this;
        async.waterfall([
            function (next:()=>void) {
                parent.friendService.getFriends(userId, function (error, result:Friend[]) {
                    if (error) return callback(error);
                    async.each(result, function (rec:Friend, eachNext) {
                        parent.friendService.deleteFriend(rec.id, eachNext);
                    }, function (error:ServiceError) {
                        if (error) return callback(error);
                        next();
                    });
                });
            },
            function (next:()=>void) {
                parent.friendService.getFriendOfList(userId, function (error, result:Friend[]) {
                    if (error) return callback(error);
                    async.each(result, function (rec:Friend, eachNext) {
                        parent.friendService.deleteFriend(rec.id, eachNext);
                    }, function (error:ServiceError) {
                        if (error) return callback(error);
                        next();
                    });
                });
            },
            function (next:()=>void) {
                parent.fileService.getFiles(userId, function (error, result:File[]) {
                    if (error) return callback(error);

                    async.each(result, function (rec:File, eachNext) {
                        parent.fileService.deleteFile(rec.id, eachNext);
                    }, function (error:ServiceError) {
                        if (error) return callback(error);
                        next();
                    });
                });
            },
            function (next:()=>void) {
                parent.getUserById(userId, function (error, user:User) {
                    if (error) return callback(error);
                    async.each(user.persona, function (personaId:string, eachNext) {
                        parent.persona.deletePersona(personaId, eachNext);
                    }, function (error:ServiceError) {
                        if (error) return callback(error);
                        next();
                    });
                })
            },
            function () {
                parent.user.deleteUser(userId, function (error:ServiceError, result:cassandra.ExecuteResult) {
                    if (error) return callback(error);
                    callback();
                });
            }
        ])
    }

    public addPersona(userId:string|cassandra.types.Uuid, authId:string, name:string, email:string, avatarUrl:string,
                      callback:(error:ServiceError, user?:User)=>void) {
        var parent = this;
        async.waterfall([
            function (next:(error:ServiceError, user?:User, isUpdate?:boolean)=>void) {
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
            function (user:User, isUpdate:boolean, next:(error:ServiceError, user?:User, isUpdate?:boolean)=>void) {
                if (isUpdate) {
                    parent.persona.createPersona(authId, name, email, avatarUrl, function (error:ServiceError, result:cassandra.ExecuteResult) {
                        if (error) return callback(error);
                        next(null, user, isUpdate);
                    });
                } else {
                    parent.persona.createPersona(authId, name, email, avatarUrl, function (error:ServiceError, result:cassandra.ExecuteResult) {
                        if (error) return callback(error);
                        next(null, user, isUpdate);
                    });
                }
            },
            function (user:User, isUpdate:boolean) {
                if (!isUpdate) {
                    user.persona.push(authId);
                }
                parent.user.createUser(user.id, user.persona, user.name, user.email, user.avatarUrl, function (error:ServiceError, result:cassandra.ExecuteResult) {
                    if (error) return callback(error);
                    return callback(null, user);
                });
            }
        ]);
    }

    public selectMainPersona(userId:string|cassandra.types.Uuid, authId:string,
                             callback:(error:ServiceError, user?:User)=>void) {
        var parent = this;
        async.waterfall([
            function (next:(error:ServiceError, user?:User)=>void) {
                parent.getUserByAuthId(authId, function (error, user:User) {
                    if (error) return callback(error);
                    next(null, user);
                });
            }, function (user:User, next:(error:ServiceError, user?:User, persona?:Persona)=>void) {
                parent.persona.getPersona(authId, function (error:ServiceError, result:cassandra.ExecuteResult) {
                    if (error) return callback(error);
                    if (result.rows.length == 0) {
                        return callback(new ServiceError(500, 'Cannot find persona:' + authId, "Main persona selection error"));
                    }
                    var row = result.first();
                    next(null, user, new Persona(authId, row['name'], row['email'], row['avatarurl'], null, null));
                });

            }, function (attachedUser:User, persona:Persona, next:(error:ServiceError, attachedUser?:User, targetUser?:User, persona?:Persona)=>void) {
                parent.getUserById(userId, function (error, targetUser:User) {
                    if (error) return callback(error);
                    if (targetUser == null) {
                        return callback(new ServiceError(500, 'Non-existing target user:' + userId, "Main persona selection error"));
                    }
                    if (targetUser.id.toString() != attachedUser.id.toString()) {
                        return callback(new ServiceError(500, 'Trying to reattach to invalid target user:' + userId, "Main persona selection error"));
                    }
                    next(null, attachedUser, targetUser, persona);
                });
            }, function (attachedUser:User, targetUser:User, persona:Persona, next) {
                parent.user.createUser(userId, targetUser.persona, persona.name, persona.email, persona.avatarUrl, function (error) {
                    parent.getUserById(userId, callback);
                });
            }
        ], function (error:ServiceError) {
            callback(error);
        });
    }

    public removePersona(userId:string | cassandra.types.Uuid, authId:string,
                         callback:(error:ServiceError, user?:User)=>void):void {
        var parent = this;
        async.waterfall([
            function (next:(error:ServiceError, user?:User)=>void) {
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
                    next(null, user);
                });
            },
            function (user:User, next:(error:ServiceError, user?:User)=>void) {
                parent.persona.deletePersona(authId, function (error:ServiceError) {
                    if (error) return callback(error);
                    next(null, user);
                });
            },
            function (user:User, next:(error:ServiceError, user?:User)=>void) {
                user.persona = user.persona.filter(function (value) {
                    return value != authId;
                });
                next(null, user);
            },
            function (user:User, next:(error:ServiceError, user?:User)=>void) {
                parent.user.createUser(user.id, user.persona, user.name, user.email, user.avatarUrl, function (error:ServiceError, result:cassandra.ExecuteResult) {
                    if (error) return callback(error);
                    next(null, user);
                });
            },
            function (user:User) {
                parent.selectMainPersona(user.id, user.persona[0], function (error, result:User) {
                    if (error) return callback(error);
                    return callback(null, result);
                });
            }
        ], function (error:ServiceError) {
            callback(error);
        });
    }
}