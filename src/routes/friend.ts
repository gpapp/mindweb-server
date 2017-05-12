import * as async from "async";
import * as bodyParser from "body-parser";
import * as cassandra from "cassandra-driver";
import {Friend} from "mindweb-request-classes";
import BaseRouter from "./BaseRouter";
import {ServiceError} from "mindweb-request-classes";
import FriendService from "../services/FriendService";

export default class FriendRouter extends BaseRouter {

    constructor(cassandraClient: cassandra.Client) {
        super();

        console.log("Setting up DB connection for friend service");
        const friendService = new FriendService(cassandraClient);

        this.router
            .get('/list',  (request, response, appCallback) => {
                friendService.getFriends(request.user.id, (error, result) => {
                    if (error) return appCallback(error);

                    response.json(result);
                    response.end();
                });
            })
            .get('/get/:id',  (request, response, appCallback) => {
                const fileId = request.params.id;
                async.waterfall(
                    [
                        (next) => {
                            friendService.getFriendById(fileId, (error, result: Friend) => {
                                if (error) return appCallback(error);
                                if (result.owner.toString() != request.user.id.toString()) {
                                    return appCallback(401, 'This is not your friend', 'Getting friend')
                                }
                                next(null, result);
                            });
                        },
                        (fileContent, next) => {
                            response.json(fileContent);
                            response.end();
                            next();
                        }],
                    (error) => {
                        if (error) appCallback(error);
                    })
            })
            .put('/create',  bodyParser.json(), (request, response, appCallback) => {
                const alias = request.body.alias;
                const linkedUserId = request.body.linkedUserId;
                const tags = request.body.tags;
                async.waterfall(
                    [
                        (next) => {
                            friendService.createFriend(request.user.id.toString(), alias, linkedUserId, tags, (error, result) => {
                                if (error) return appCallback(error);
                                next(null, result);
                            });
                        },
                        (fileContent, next) => {
                            response.json(fileContent);
                            response.end();
                            next();
                        }],
                    (error) => {
                        if (error) appCallback(error);
                    })
            })
            .put('/update/:id',  bodyParser.json(), (request, response, appCallback) => {
                const friendId = request.body.id;
                const alias = request.body.alias;
                const tags = request.body.tags;
                async.waterfall(
                    [
                        (next) => {
                            friendService.getFriendById(friendId, next);
                        },
                        (friend: Friend, next) => {
                            if (friend.owner.toString() != request.user.id.toString()) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            friendService.updateFriend(friendId, alias, tags, (error, result) => {
                                if (error) return appCallback(error);
                                next(null, result);
                            });
                        },
                        (friend: Friend, next) => {
                            response.json(friend);
                            response.end();
                            next();
                        }
                    ],
                    (error) => {
                        if (error) appCallback(error);
                    });
            })
            .put('/tag',  bodyParser.json(), (request, response, appCallback) => {
                const friendId = request.body.id;
                const tag = request.body.tag;
                async.waterfall(
                    [
                        (next) => {
                            friendService.getFriendById(friendId, next);
                        },
                        (friend: Friend, next) => {
                            if (friend.owner.toString() != request.user.id.toString()) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            friendService.tagFriend(friendId, tag, (error, result) => {
                                if (error) return appCallback(error);
                                next(null, result);
                            });
                        },
                        (friend: Friend, next) => {
                            response.json(friend);
                            response.end();
                            next();
                        }
                    ],
                    (error) => {
                        if (error) appCallback(error);
                    });
            })
            .put('/untag',  bodyParser.json(), (request, response, appCallback) => {
                const friendId = request.body.id;
                const tag = request.body.tag;
                async.waterfall(
                    [
                        (next) => {
                            friendService.getFriendById(friendId, next);
                        },
                        (friend: Friend, next) => {
                            if (friend.owner.toString() != request.user.id.toString()) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            friendService.untagFriend(friendId, tag, (error, result) => {
                                if (error) return appCallback(error);
                                next(null, result);
                            });
                        },
                        (friend: Friend, next) => {
                            response.json(friend);
                            response.end();
                            next();
                        }
                    ],
                    (error) => {
                        if (error) appCallback(error);
                    });
            })
            .delete('/remove/:id',  (request, response, appCallback) => {
                const friendId = request.params.id;
                async.waterfall(
                    [
                        (next) => {
                            friendService.getFriendById(friendId, next);
                        },
                        (friend: Friend, next) => {
                            if (friend.owner.toString() === request.user.id.toString()) {
                                friendService.deleteFriend(friendId, (error: ServiceError) => {
                                    if (error) return appCallback(error);
                                    next(null, friend);
                                });
                            } else {
                                appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                        },
                        (fileInfo, next) => {
                            response.json(fileInfo);
                            response.end();
                            next();
                        }
                    ],
                    (error) => {
                        if (error) appCallback(error);
                    })
            });
    }

}

