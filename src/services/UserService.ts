import * as async from "async";
import * as cassandra from "cassandra-driver";
import {MapContainer} from "mindweb-request-classes";
import {User} from "mindweb-request-classes";
import {Persona} from "mindweb-request-classes";
import {Friend} from "mindweb-request-classes";
import {ServiceError} from "mindweb-request-classes";
import UserDAO from "../dao/UserDAO";
import UserPersonaDAO from "../dao/UserPersonaDAO";
import MapService from "./MapService";
import FriendService from "./FriendService";


export default class UserService {
    private connection;
    private _user: UserDAO;
    private _persona: UserPersonaDAO;
    private _friendService: FriendService;
    private _fileService: MapService;

    constructor(connection) {
        this.connection = connection;
    }

    get user(): UserDAO {
        if (this._user == null)
            this._user = new UserDAO(this.connection);
        return this._user;
    }

    get persona(): UserPersonaDAO {
        if (this._persona == null)
            this._persona = new UserPersonaDAO(this.connection);
        return this._persona;
    }

    get friendService(): FriendService {
        if (this._friendService == null)
            this._friendService = new FriendService(this.connection);
        return this._friendService;
    }

    get fileService(): MapService {
        if (this._fileService == null)
            this._fileService = new MapService(this.connection);
        return this._fileService;
    }

    public getUserByAuthId(authId: string, next: (error: ServiceError, user?: User) => void) {
        this.user.getUserByAuthId(authId, (error: ServiceError, result: cassandra.types.ResultSet) => {
            if (error) {
                return next(error, null);
            }
            if (result.rows.length == 0) {
                return next(null, null);
            }
            const row = result.first();
            next(null, new User(row['id'], row['persona'], row['name'], row['email'], row['avatarurl'], row['created'], row['modified']));
        });
    }

    public getUserById(id: string|cassandra.types.Uuid, next: (error: ServiceError, user?: User) => void) {
        this.user.getUserById(id, (error: ServiceError, result: cassandra.types.ResultSet) => {
            if (error) {
                return next(error);
            }
            if (result.rows.length == 0) {
                return next(new ServiceError(403, 'Cannot find user:' + id, 'getUserById'));
            }
            const row = result.first();
            next(null, new User(row['id'], row['persona'], row['name'], row['email'], row['avatarurl'], row['created'], row['modified']));
        });
    }

    public createUser(authId: string, name: string, email: string, avatarUrl: string, callback: (error: ServiceError, user?: User) => void) {
        const parent = this;
        this.getUserByAuthId(authId, (error, result: User) => {
            if (error) return callback(error);
            if (result != null) {
                return callback(new ServiceError(500, "User already exists with authid: " + authId, "User creation error"), result);
            }
            const userId = cassandra.types.Uuid.random();
            parent.persona.createPersona(authId, name, email, avatarUrl, (error: ServiceError, result: cassandra.types.ResultSet) => {
                if (error) return callback(error);
                parent.user.createUser(userId, [authId], name, email, avatarUrl, (error) => {
                    if (error) return callback(error);
                    parent.getUserByAuthId(authId, callback);
                });
            });
        });
    }

    public deleteUser(userId: string|cassandra.types.Uuid, callback: (error?: ServiceError) => void) {
        const parent = this;
        async.waterfall([
            function (next: () => void) {
                parent.friendService.getFriends(userId, (error, result: Friend[]) => {
                    if (error) return callback(error);
                    async.each(result, (rec: Friend, eachNext) => {
                        parent.friendService.deleteFriend(rec.id, eachNext);
                    }, (error: ServiceError) => {
                        if (error) return callback(error);
                        next();
                    });
                });
            },
            function (next: () => void) {
                parent.friendService.getFriendOfList(userId, (error, result: Friend[]) => {
                    if (error) return callback(error);
                    async.each(result, (rec: Friend, eachNext) => {
                        parent.friendService.deleteFriend(rec.id, eachNext);
                    }, (error: ServiceError) => {
                        if (error) return callback(error);
                        next();
                    });
                });
            },
            function (next: () => void) {
                parent.fileService.getMapContainers(userId, (error, result: MapContainer[]) => {
                    if (error) return callback(error);

                    async.each(result, (rec: MapContainer, eachNext) => {
                        parent.fileService.deleteMap(rec.id, eachNext);
                    }, (error: ServiceError) => {
                        if (error) return callback(error);
                        next();
                    });
                });
            },
            function (next: () => void) {
                parent.getUserById(userId, (error, user: User) => {
                    if (error) return callback(error);
                    async.each(user.persona, (personaId: string, eachNext) => {
                        parent.persona.deletePersona(personaId, eachNext);
                    }, (error: ServiceError) => {
                        if (error) return callback(error);
                        next();
                    });
                })
            },
            () => {
                parent.user.deleteUser(userId, (error: ServiceError, result: cassandra.types.ResultSet) => {
                    if (error) return callback(error);
                    callback();
                });
            }
        ])
    }

    public addPersona(userId: string|cassandra.types.Uuid, authId: string, name: string, email: string, avatarUrl: string,
                      callback: (error: ServiceError, user?: User) => void) {
        const parent = this;
        async.waterfall([
            function (next: (error: ServiceError, user?: User, isUpdate?: boolean) => void) {
                // check if persona already exists
                parent.getUserByAuthId(authId, (error, user: User) => {
                    if (error) return callback(error);
                    if (user == null) {
                        parent.getUserById(userId, (error, user) => {
                            next(error, user, false);
                        });
                        return;
                    }
                    if (userId.toString() != user.id.toString()) {
                        return callback(new ServiceError(500, 'Persona already associated to another user', 'Add persona error'));
                    }
                    // check to see if the persona already exists
                    let isUpdate = false;
                    for (let i in user.persona) {
                        if (user.persona[i] === authId) {
                            isUpdate = true;
                            break;
                        }
                    }
                    next(null, user, isUpdate);
                });
            },
            function (user: User, isUpdate: boolean, next: (error: ServiceError, user?: User, isUpdate?: boolean) => void) {
                if (isUpdate) {
                    parent.persona.createPersona(authId, name, email, avatarUrl, (error: ServiceError, result: cassandra.types.ResultSet) => {
                        if (error) return callback(error);
                        next(null, user, isUpdate);
                    });
                } else {
                    parent.persona.createPersona(authId, name, email, avatarUrl, (error: ServiceError, result: cassandra.types.ResultSet) => {
                        if (error) return callback(error);
                        next(null, user, isUpdate);
                    });
                }
            },
            (user: User, isUpdate: boolean) => {
                if (!isUpdate) {
                    user.persona.push(authId);
                }
                parent.user.createUser(user.id, user.persona, user.name, user.email, user.avatarUrl, (error: ServiceError, result: cassandra.types.ResultSet) => {
                    if (error) return callback(error);
                    return callback(null, user);
                });
            }
        ]);
    }

    public selectMainPersona(userId: string|cassandra.types.Uuid, authId: string,
                             callback: (error: ServiceError, user?: User) => void) {
        const parent = this;
        async.waterfall([
            function (next: (error: ServiceError, user?: User) => void) {
                parent.getUserByAuthId(authId, (error, user: User) => {
                    if (error) return callback(error);
                    next(null, user);
                });
            }, function (user: User, next: (error: ServiceError, user?: User, persona?: Persona) => void) {
                parent.persona.getPersona(authId, (error: ServiceError, result: cassandra.types.ResultSet) => {
                    if (error) return callback(error);
                    if (result.rows.length == 0) {
                        return callback(new ServiceError(500, 'Cannot find persona:' + authId, "Main persona selection error"));
                    }
                    const row = result.first();
                    next(null, user, new Persona(authId, row['name'], row['email'], row['avatarurl'], null, null));
                });

            }, function (attachedUser: User, persona: Persona, next: (error: ServiceError, attachedUser?: User, targetUser?: User, persona?: Persona) => void) {
                parent.getUserById(userId, (error, targetUser: User) => {
                    if (error) return callback(error);
                    if (targetUser == null) {
                        return callback(new ServiceError(500, 'Non-existing target user:' + userId, "Main persona selection error"));
                    }
                    if (targetUser.id.toString() != attachedUser.id.toString()) {
                        return callback(new ServiceError(500, 'Trying to reattach to invalid target user:' + userId, "Main persona selection error"));
                    }
                    next(null, attachedUser, targetUser, persona);
                });
            }, (attachedUser: User, targetUser: User, persona: Persona, next) => {
                parent.user.createUser(userId, targetUser.persona, persona.name, persona.email, persona.avatarUrl, (error) => {
                    parent.getUserById(userId, callback);
                });
            }
        ], (error: ServiceError) => {
            callback(error);
        });
    }

    public removePersona(userId: string | cassandra.types.Uuid, authId: string,
                         callback: (error: ServiceError, user?: User) => void): void {
        const parent = this;
        async.waterfall([
            function (next: (error: ServiceError, user?: User) => void) {
                // check if persona already exists
                parent.getUserByAuthId(authId, (error, user: User) => {
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
            function (user: User, next: (error: ServiceError, user?: User) => void) {
                parent.persona.deletePersona(authId, (error: ServiceError) => {
                    if (error) return callback(error);
                    next(null, user);
                });
            },
            function (user: User, next: (error: ServiceError, user?: User) => void) {
                user.persona = user.persona.filter((value) => {
                    return value != authId;
                });
                next(null, user);
            },
            function (user: User, next: (error: ServiceError, user?: User) => void) {
                parent.user.createUser(user.id, user.persona, user.name, user.email, user.avatarUrl, (error: ServiceError, result: cassandra.types.ResultSet) => {
                    if (error) return callback(error);
                    next(null, user);
                });
            },
            (user: User) => {
                parent.selectMainPersona(user.id, user.persona[0], (error, result: User) => {
                    if (error) return callback(error);
                    return callback(null, result);
                });
            }
        ], (error: ServiceError) => {
            callback(error);
        });
    }
}