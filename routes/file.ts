/// <reference path="../typings/tsd.d.ts" />
import * as async from 'async';
import * as bodyParser from 'body-parser';
import * as express from 'express';
import * as cassandra from 'cassandra-driver';

import ServiceError from '../classes/ServiceError';
import EditAction from "../classes/EditAction";
import StorageSchema from '../db/storage_schema';
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
export default class FileRouter {
    private router;

    constructor(cassandraOptions:cassandra.client.Options, next:Function) {
        this.router = express.Router();

        console.log("Setting up DB connection for file service");
        var cassandraClient = new cassandra.Client(cassandraOptions);
        cassandraClient.connect(function (error, ok) {
            if (error) {
                console.error(error);
                throw new Error('Cannot connect to database');
            }
            console.log('Connected to database:' + ok);
            StorageSchema(cassandraClient,next);
            fileService = new FileService(cassandraClient);
        });

        this.router
            .get('/files', FileRouter.ensureAuthenticated, function (request, response, appCallback) {
                fileService.getFiles(request.session.passport.user.id, function (error, result) {
                    if (error) return appCallback(error);

                    response.json(result);
                    response.end();
                });
            })
            .get('/file/:id', FileRouter.ensureAuthenticated, function (request, response, appCallback) {
                async.waterfall(
                    [
                        function (next) {
                            fileService.getFile(request.params.id, next);
                        },
                        function (result, next) {
                            var fileInfo = result;
                            if (fileInfo.canView(request.session.passport.user)) {
                                var lastVersionId = fileInfo.versions[0];
                                fileService.getFileVersion(lastVersionId, function (error, result) {
                                    if (error) return appCallback(error);
                                    result.file = fileInfo;
                                    next(null, result);
                                });
                            } else {
                                appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
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
            .delete('/file/:id', FileRouter.ensureAuthenticated, function (request, response, appCallback) {
                var fileId = request.params.id;
                async.waterfall(
                    [
                        function (next) {
                            fileService.getFile(fileId, next);
                        },
                        function (fileInfo, next) {
                            if (fileInfo.canRemove(request.session.passport.user)) {
                                fileService.deleteFile(fileId, function (error, result) {
                                    if (error) return appCallback(error);
                                    next(null, fileInfo);
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
            })
            .post('/rename/:id', FileRouter.ensureAuthenticated, bodyParser.json(), function (request, response, appCallback) {
                var fileId = request.params.id;
                var newName = request.body.newName + '.mm';
                async.waterfall(
                    [
                        function (next) {
                            fileService.getFile(fileId, next);
                        },
                        function (fileInfo, next) {
                            if (fileInfo.canRemove(request.session.passport.user)) {
                                fileService.renameFile(fileId, newName, function (error, result) {
                                    if (error) return appCallback(error);
                                    next(null, fileInfo);
                                });
                            } else {
                                appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
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
            .post('/create', FileRouter.ensureAuthenticated, bodyParser.json(), function (request, response, appCallback) {

                var name = request.body.name + '.mm';
                var isPublic = request.body.isPublic;
                var viewers = request.body.viewers;
                var editors = request.body.editors;
                async.waterfall(
                    [
                        function (next) {
                            fileService.createNewVersion(request.session.passport.user.id, name, isPublic, viewers, editors, JSON.stringify(EMPTY_MAP), next);
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
            .put('/change/:id', FileRouter.ensureAuthenticated, bodyParser.json(), function (request, response, appCallback) {
                var fileId = request.params.id;
                var actions = request.body.actions;
                async.waterfall(
                    [
                        function (next) {
                            fileService.getFile(fileId, next);
                        },
                        function (fileInfo, next) {
                            if (fileInfo.canEdit(request.session.passport.user)) {
                                var fileVersionId = fileInfo.versions[0];
                                fileService.getFileVersion(fileVersionId, function (error, fileVersion) {
                                    if (error) return appCallback(error);
                                    next(null, fileVersionId, fileVersion.content)
                                });
                            } else {
                                appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
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
            .get('/convert/freeplane/:id', FileRouter.ensureAuthenticated, function (request, response, appCallback) {
                var fileId = request.params.id;
                async.waterfall(
                    [
                        function (next) {
                            fileService.getFile(fileId, next);
                        },
                        function (fileInfo, next) {
                            if (fileInfo.canView(request.session.passport.user)) {
                                var fileVersionId = fileInfo.versions[0];
                                fileService.getFileVersion(fileVersionId, function (error, fileVersion) {
                                    if (error) return appCallback(error);
                                    next(null, fileInfo, fileVersion)
                                });
                            } else {
                                appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
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
            .post('/upload', FileRouter.ensureAuthenticated, upload.array('file', 10), function (request, response, appCallback) {
                async.forEachOf(
                    request.files,
                    function (file, index, next) {
                        console.log("Received request to store file: " + file.originalname + " length:" + file.size);
                        ConverterService.fromFreeplane(file.buffer, function (error, rawmap) {
                            if (error) return appCallback(error);

                            fileService.createNewVersion(request.session.passport.user.id, file.originalname, false, null, null, JSON.stringify(rawmap), next);
                        });
                    },
                    function (error) {
                        if (error) return appCallback(error);
                        response.end();
                    })
            });
    }

    private static ensureAuthenticated(request, response, next) {
        if (request.session.passport.user) {
            return next(null, request, response);
        }
        next(new ServiceError(401, 'The user has no authentication information', "Authentication failed"));
    }

    getRouter() {
        return this.router;
    }
}

