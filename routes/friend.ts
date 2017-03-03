import * as async from "async";
import * as bodyParser from "body-parser";
import * as cassandra from "cassandra-driver";
import Friend from "mindweb-request-classes/dist/classes/Friend";
import BaseRouter from "./BaseRouter";
import ServiceError from "mindweb-request-classes/dist/classes/ServiceError";
import FriendService from "../services/FriendService";

export default class FriendRouter extends BaseRouter {

    constructor(cassandraClient: cassandra.Client) {
        super();

        console.log("Setting up DB connection for file service");
        const friendService = new FriendService(cassandraClient);

        this.router
            .get('/list',  function (request, response, appCallback) {
                friendService.getFriends(request.user.id, function (error, result) {
                    if (error) return appCallback(error);

                    response.json(result);
                    response.end();
                });
            })
            .get('/get/:id',  function (request, response, appCallback) {
                const fileId = request.params.id;
                async.waterfall(
                    [
                        function (next) {
                            friendService.getFriendById(fileId, function (error, result: Friend) {
                                if (error) return appCallback(error);
                                if (result.owner.toString() != request.user.id.toString()) {
                                    return appCallback(401, 'This is not your friend', 'Getting friend')
                                }
                                next(null, result);
                            });
                        },
                        function (fileContent, next) {
                            response.json(fileContent);
                            response.end();
                            next();
                        }],
                    function (error) {
                        if (error) appCallback(error);
                    })
            })
            .put('/create',  bodyParser.json(), function (request, response, appCallback) {
                const alias = request.body.alias;
                const linkedUserId = request.body.linkedUserId;
                const tags = request.body.tags;
                async.waterfall(
                    [
                        function (next) {
                            friendService.createFriend(request.user.id.toString(), alias, linkedUserId, tags, function (error, result) {
                                if (error) return appCallback(error);
                                next(null, result);
                            });
                        },
                        function (fileContent, next) {
                            response.json(fileContent);
                            response.end();
                            next();
                        }],
                    function (error) {
                        if (error) appCallback(error);
                    })
            })
            .put('/update/:id',  bodyParser.json(), function (request, response, appCallback) {
                const friendId = request.body.id;
                const alias = request.body.alias;
                const tags = request.body.tags;
                async.waterfall(
                    [
                        function (next) {
                            friendService.getFriendById(friendId, next);
                        },
                        function (friend: Friend, next) {
                            if (friend.owner.toString() != request.user.id.toString()) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            friendService.updateFriend(friendId, alias, tags, function (error, result) {
                                if (error) return appCallback(error);
                                next(null, result);
                            });
                        },
                        function (friend: Friend, next) {
                            response.json(friend);
                            response.end();
                            next();
                        }
                    ],
                    function (error) {
                        if (error) appCallback(error);
                    });
            })
            .put('/tag',  bodyParser.json(), function (request, response, appCallback) {
                const friendId = request.body.id;
                const tag = request.body.tag;
                async.waterfall(
                    [
                        function (next) {
                            friendService.getFriendById(friendId, next);
                        },
                        function (friend: Friend, next) {
                            if (friend.owner.toString() != request.user.id.toString()) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            friendService.tagFriend(friendId, tag, function (error, result) {
                                if (error) return appCallback(error);
                                next(null, result);
                            });
                        },
                        function (friend: Friend, next) {
                            response.json(friend);
                            response.end();
                            next();
                        }
                    ],
                    function (error) {
                        if (error) appCallback(error);
                    });
            })
            .put('/untag',  bodyParser.json(), function (request, response, appCallback) {
                const friendId = request.body.id;
                const tag = request.body.tag;
                async.waterfall(
                    [
                        function (next) {
                            friendService.getFriendById(friendId, next);
                        },
                        function (friend: Friend, next) {
                            if (friend.owner.toString() != request.user.id.toString()) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            friendService.untagFriend(friendId, tag, function (error, result) {
                                if (error) return appCallback(error);
                                next(null, result);
                            });
                        },
                        function (friend: Friend, next) {
                            response.json(friend);
                            response.end();
                            next();
                        }
                    ],
                    function (error) {
                        if (error) appCallback(error);
                    });
            })
            .delete('/remove/:id',  function (request, response, appCallback) {
                const friendId = request.params.id;
                async.waterfall(
                    [
                        function (next) {
                            friendService.getFriendById(friendId, next);
                        },
                        function (friend: Friend, next) {
                            if (friend.owner.toString() === request.user.id.toString()) {
                                friendService.deleteFriend(friendId, function (error: ServiceError) {
                                    if (error) return appCallback(error);
                                    next(null, friend);
                                });
                            } else {
                                appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                        },
                        function (fileInfo, next) {
                            response.json(fileInfo);
                            response.end();
                            next();
                        }
                    ],
                    function (error) {
                        if (error) appCallback(error);
                    })
            });
    }

}

