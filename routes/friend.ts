import * as async from 'async';
import * as bodyParser from 'body-parser';
import * as express from 'express';
import * as cassandra from 'cassandra-driver';

import Friend from "../classes/Friend";

import BaseRouter from "./BaseRouter";
import ServiceError from 'map-editor/dist/classes/ServiceError';
import FriendService from '../services/FriendService';

var friendService:FriendService;
export default class FriendRouter extends BaseRouter {

    constructor(cassandraClient:cassandra.Client) {
        super();

        console.log("Setting up DB connection for file service");
        friendService = new FriendService(cassandraClient);

        this.router
            .get('/list', BaseRouter.ensureAuthenticated, function (request, response, appCallback) {
                friendService.getFriends(request.user.id, function (error, result) {
                    if (error) return appCallback(error);

                    response.json(result);
                    response.end();
                });
            })
            .get('/get/:id', BaseRouter.ensureAuthenticated, function (request, response, appCallback) {
                var fileId = request.params.id;
                async.waterfall(
                    [
                        function (next) {
                            friendService.getFriendById(fileId, function (error, result:Friend) {
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
            .put('/create', BaseRouter.ensureAuthenticated, bodyParser.json(), function (request, response, appCallback) {
                var alias = request.body.alias;
                var linkedUserId = request.body.linkedUserId;
                var tags = request.body.tags;
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
            .put('/update/:id', BaseRouter.ensureAuthenticated, bodyParser.json(), function (request, response, appCallback) {
                var friendId = request.body.id;
                var alias = request.body.alias;
                var tags = request.body.tags;
                async.waterfall(
                    [
                        function (next) {
                            friendService.getFriendById(friendId, next);
                        },
                        function (friend:Friend, next) {
                            if (friend.owner.toString() != request.user.id.toString()) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            friendService.updateFriend(friendId, alias, tags, function (error, result) {
                                if (error) return appCallback(error);
                                next(null, result);
                            });
                        },
                        function (friend:Friend, next) {
                            response.json(friend);
                            response.end();
                            next();
                        }
                    ],
                    function (error) {
                        if (error) appCallback(error);
                    });
            })
            .put('/tag', BaseRouter.ensureAuthenticated, bodyParser.json(), function (request, response, appCallback) {
                var friendId = request.body.id;
                var tag = request.body.tag;
                async.waterfall(
                    [
                        function (next) {
                            friendService.getFriendById(friendId, next);
                        },
                        function (friend:Friend, next) {
                            if (friend.owner.toString() != request.user.id.toString()) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            friendService.tagFriend(friendId, tag, function (error, result) {
                                if (error) return appCallback(error);
                                next(null, result);
                            });
                        },
                        function (friend:Friend, next) {
                            response.json(friend);
                            response.end();
                            next();
                        }
                    ],
                    function (error) {
                        if (error) appCallback(error);
                    });
            })
            .put('/untag', BaseRouter.ensureAuthenticated, bodyParser.json(), function (request, response, appCallback) {
                var friendId = request.body.id;
                var tag = request.body.tag;
                async.waterfall(
                    [
                        function (next) {
                            friendService.getFriendById(friendId, next);
                        },
                        function (friend:Friend, next) {
                            if (friend.owner.toString() != request.user.id.toString()) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            friendService.untagFriend(friendId, tag, function (error, result) {
                                if (error) return appCallback(error);
                                next(null, result);
                            });
                        },
                        function (friend:Friend, next) {
                            response.json(friend);
                            response.end();
                            next();
                        }
                    ],
                    function (error) {
                        if (error) appCallback(error);
                    });
            })
            .delete('/remove/:id', BaseRouter.ensureAuthenticated, function (request, response, appCallback) {
                var friendId = request.params.id;
                async.waterfall(
                    [
                        function (next) {
                            friendService.getFriendById(friendId, next);
                        },
                        function (friend:Friend, next) {
                            if (friend.owner.toString() === request.user.id.toString()) {
                                friendService.deleteFriend(friendId, function (error:ServiceError) {
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

