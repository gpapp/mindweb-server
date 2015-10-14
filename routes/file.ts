/// <reference path="../typings/tsd.d.ts" />
import * as async from 'async';
import * as bodyParser from 'body-parser';
import * as cassandra from 'cassandra-driver';

import File from '../classes/File';
import ServiceError from '../classes/ServiceError';
import EditAction from "../classes/EditAction";

import StorageSchema from '../db/storage_schema';

import BaseRouter from './BaseRouter';
import FileService from '../services/FileService';
import * as EditorService from '../services/EditorService';
import * as ConverterService from '../services/ConverterService'

var multer = require('multer');

const EMPTY_MAP = {
    $: {version: "freeplane 1.3.0"},
    rootNode: {$: {ID: "ID_" + (Math.random() * 10000000000).toFixed()}, nodeMarkdown: 'New map', open: true}
};

const upload = multer({inMemory: true});

var fileService;
export default class FileRouter extends BaseRouter {

    constructor(cassandraOptions:cassandra.client.Options, next:Function) {
        super();

        console.log("Setting up DB connection for file service");
        var cassandraClient = new cassandra.Client(cassandraOptions);
        cassandraClient.connect(function (error, ok) {
            if (error) {
                console.error(error);
                throw new Error('Cannot connect to database');
            }
            console.log('Connected to database:' + ok);
            StorageSchema(cassandraClient, next);
            fileService = new FileService(cassandraClient);
        });

        this.router
            .get('/files', BaseRouter.ensureAuthenticated, function (request, response, appCallback) {
                fileService.getFiles(request.user.id, function (error, result) {
                    if (error) return appCallback(error);

                    response.json(result);
                    response.end();
                });
            })
            .get('/file/:id', BaseRouter.ensureAuthenticated, function (request, response, appCallback) {
                async.waterfall(
                    [
                        function (next) {
                            fileService.getFile(request.params.id, next);
                        },
                        function (fileInfo:File, next) {
                            if (!fileInfo.canView(request.user.id)) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            var lastVersionId = fileInfo.versions[0];
                            fileService.getFileVersion(lastVersionId, function (error, result) {
                                if (error) return appCallback(error);
                                result.file = fileInfo;
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
            .put('/tag', BaseRouter.ensureAuthenticated, bodyParser.json(), function (request, response, appCallback) {
                var fileId = request.body.id;
                var tag = request.body.tag;
                async.waterfall(
                    [
                        function (next) {
                            fileService.getFile(fileId, next);
                        },
                        function (friend:File, next) {
                            if (friend.owner.toString() != request.user.id.toString()) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            fileService.tagFriend(fileId, tag, function (error, result) {
                                if (error) return appCallback(error);
                                next(null, result);
                            });
                        },
                        function (friend:File, next) {
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
                var fileId = request.body.id;
                var tag = request.body.tag;
                async.waterfall(
                    [
                        function (next) {
                            fileService.getFile(fileId, next);
                        },
                        function (friend:File, next) {
                            if (friend.owner.toString() != request.user.id.toString()) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            fileService.untagFriend(fileId, tag, function (error, result) {
                                if (error) return appCallback(error);
                                next(null, result);
                            });
                        },
                        function (friend:File, next) {
                            response.json(friend);
                            response.end();
                            next();
                        }
                    ],
                    function (error) {
                        if (error) appCallback(error);
                    });
            })
            .delete('/file/:id', BaseRouter.ensureAuthenticated, function (request, response, appCallback) {
                var fileId = request.params.id;
                async.waterfall(
                    [
                        function (next) {
                            fileService.getFile(fileId, next);
                        },
                        function (fileInfo, next) {
                            if (!fileInfo.canRemove(request.user.id)) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            fileService.deleteFile(fileId, function (error, result) {
                                if (error) return appCallback(error);
                                next(null, fileInfo);
                            });
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
            })
            .post('/rename/:id', BaseRouter.ensureAuthenticated, bodyParser.json(), function (request, response, appCallback) {
                var fileId = request.params.id;
                var newName = request.body.newName + '.mm';
                async.waterfall(
                    [
                        function (next) {
                            fileService.getFile(fileId, next);
                        },
                        function (fileInfo, next) {
                            if (!fileInfo.canRemove(request.user.id)) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            fileService.renameFile(fileId, newName, function (error, result) {
                                if (error) return appCallback(error);
                                next(null, fileInfo);
                            });
                        },
                        function (fileInfo, next) {
                            fileInfo.name = newName;
                            response.json(fileInfo);
                            response.end();
                            next();
                        }
                    ],
                    function (error) {
                        if (error) appCallback(error);
                    })
            })
            .post('/create', BaseRouter.ensureAuthenticated, bodyParser.json(), function (request, response, appCallback) {

                var name = request.body.name + '.mm';
                var isPublic = request.body.isPublic;
                var viewers = request.body.viewers;
                var editors = request.body.editors;
                async.waterfall(
                    [
                        function (next) {
                            fileService.createNewVersion(request.user.id, name, isPublic, viewers, editors, JSON.stringify(EMPTY_MAP), next);
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
            })
            .put('/change/:id', BaseRouter.ensureAuthenticated, bodyParser.json(), function (request, response, appCallback) {
                var fileId = request.params.id;
                var actions = request.body.actions;
                async.waterfall(
                    [
                        function (next) {
                            fileService.getFile(fileId, next);
                        },
                        function (fileInfo, next) {
                            if (!fileInfo.canEdit(request.user.id)) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            var fileVersionId = fileInfo.versions[0];
                            fileService.getFileVersion(fileVersionId, function (error, fileVersion) {
                                if (error) return appCallback(error);
                                next(null, fileVersionId, fileVersion.content)
                            });
                        },
                        function (fileVersionId, fileContent, next) {
                            async.each(
                                actions,
                                function (action:EditAction, callback) {
                                    EditorService.applyAction(fileContent, action, callback);
                                },
                                function (error) {
                                    if (error) {
                                        console.error("Error applying action: " + error);
                                    }
                                    next(null, fileVersionId, fileContent);
                                }
                            );
                        },
                        function (fileVersionId, fileContent, next) {
                            fileService.updateFileVersion(fileVersionId, JSON.stringify(fileContent), next);
                        },
                        function (result, next) {
                            response.end();
                            next();
                        }
                    ],
                    function (error) {
                        if (error) appCallback(error);
                    })
            })
            .get('/convert/freeplane/:id', BaseRouter.ensureAuthenticated, function (request, response, appCallback) {
                var fileId = request.params.id;
                async.waterfall(
                    [
                        function (next) {
                            fileService.getFile(fileId, next);
                        },
                        function (fileInfo, next) {
                            if (!fileInfo.canView(request.user.id)) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            var fileVersionId = fileInfo.versions[0];
                            fileService.getFileVersion(fileVersionId, function (error, fileVersion) {
                                if (error) return appCallback(error);
                                next(null, fileInfo, fileVersion)
                            });
                        },
                        function (fileInfo, fileVersion, next) {
                            ConverterService.toFreeplane(fileVersion.content, function (error, result) {
                                if (error) return appCallback(error);

                                response.write(result);
                                response.end();
                            });
                        }],
                    function (error) {
                        if (error) appCallback(error);
                    });
            })
            .post('/upload', BaseRouter.ensureAuthenticated, upload.array('file', 10), function (request, response, appCallback) {
                async.forEachOf(
                    request.files,
                    function (file, index, next) {
                        console.log("Received request to store file: " + file.originalname + " length:" + file.size);
                        ConverterService.fromFreeplane(file.buffer, function (error, rawmap) {
                            if (error) return appCallback(error);

                            fileService.createNewVersion(request.user.id, file.originalname, false, null, null, null, JSON.stringify(rawmap), next);
                        });
                    },
                    function (error) {
                        if (error) return appCallback(error);
                        response.end();
                    })
            });
    }
}

