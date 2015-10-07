import async from 'async';
import express from 'express';
import cassandra from 'cassandra-driver';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import multer from 'multer';

import ServiceError from '../classes/ServiceError.es6';
import FileService from '../services/FileService';
import * as EditorService from '../services/EditorService';
import * as ConverterService from '../services/ConverterService'

const EMPTY_MAP = {
    $: {version: "freeplane 1.3.0"},
    rootNode: {$: {ID: "ID_" + (Math.random() * 10000000000).toFixed()}, nodeMarkdown: 'New map', open: true}
};

var router = express.Router();
var upload = multer({inMemory: true});

var user;
var fileService;

router.use(bodyParser.json());
router.use(bodyParser.urlencoded({extended: false}));
router.use(cookieParser());

router
    .get('/files', ensureAuthenticated, function (request, response, appCallback) {
        fileService.getFiles(user.id, function (error, result) {
            if (error) return appCallback(error);

            response.json(result);
            response.end();
        });
    })
    .get('/file/:id', ensureAuthenticated, function (request, response, appCallback) {
        async.waterfall(
            [
                function (next) {
                    fileService.getFile(request.params.id, next);
                },
                function (result, next) {
                    var fileInfo = result;
                    if (fileInfo.canView(user)) {
                        var lastVersionId = fileInfo.versions[0];
                        fileService.getFileVersion(lastVersionId, function (error, result) {
                            if (error) return appCallback(error);
                            result.file = fileInfo;
                            next(null, result);
                        });
                    } else {
                        appCallback(new ServiceError(401, 'Unauthorized'));
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
    .delete('/file/:id', ensureAuthenticated, function (request, response, appCallback) {
        var fileId = request.params.id;
        async.waterfall(
            [
                function (next) {
                    fileService.getFile(fileId, next);
                },
                function (fileInfo, next) {
                    if (fileInfo.canRemove(user)) {
                        fileService.deleteFile(fileId, function (error, result) {
                            if (error) return appCallback(error);
                            next(null, fileInfo);
                        });
                    } else {
                        appCallback(new ServiceError(401, 'Unauthorized'));
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
    .post('/rename/:id', ensureAuthenticated, bodyParser.json(), function (request, response, appCallback) {
        var fileId = request.params.id;
        var newName = request.body.newName + '.mm';
        async.waterfall(
            [
                function (next) {
                    fileService.getFile(fileId, next);
                },
                function (fileInfo, next) {
                    if (fileInfo.canRemove(user)) {
                        fileService.renameFile(fileId, newName, function (error, result) {
                            if (error) return appCallback(error);
                            next(null, fileInfo);
                        });
                    } else {
                        appCallback(new ServiceError(401, 'Unauthorized'));
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
    .post('/create', ensureAuthenticated, bodyParser.json(), function (request, response, appCallback) {

        var name = request.body.name + '.mm';
        var isPublic = request.body.isPublic;
        var viewers = request.body.viewers;
        var editors = request.body.editors;
        async.waterfall(
            [
                function (next) {
                    fileService.createNewVersion(user.id, name, isPublic, viewers, editors, JSON.stringify(EMPTY_MAP), next);
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
    .put('/change/:id', ensureAuthenticated, bodyParser.json(), function (request, response, appCallback) {
        var fileId = request.params.id;
        var actions = request.body.actions;
        async.waterfall(
            [
                function (next) {
                    fileService.getFile(fileId, next);
                },
                function (fileInfo, next) {
                    if (fileInfo.canEdit(user)) {
                        var fileVersionId = fileInfo.versions[0];
                        fileService.getFileVersion(fileVersionId, function (error, fileVersion) {
                            if (error) return appCallback(error);
                            next(null, fileVersionId, fileVersion.content)
                        });
                    } else {
                        appCallback(new ServiceError(401, 'Unauthorized'));
                    }
                },
                function (fileVersionId, fileContent, next) {
                    async.each(
                        actions,
                        function (action, callback) {
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
    .get('/convert/freeplane/:id', ensureAuthenticated, function (request, response, appCallback) {
        var fileId = request.params.id;
        async.waterfall(
            [
                function (next) {
                    fileService.getFile(fileId, next);
                },
                function (fileInfo, next) {
                    if (fileInfo.canView(user)) {
                        var fileVersionId = fileInfo.versions[0];
                        fileService.getFileVersion(fileVersionId, function (error, fileVersion) {
                            if (error) return appCallback(error);
                            next(null, fileInfo, fileVersion)
                        });
                    } else {
                        appCallback(new ServiceError(401, 'Unauthorized'));
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
    .post('/upload', ensureAuthenticated, upload.array('file', 10), function (request, response, appCallback) {
        async.forEachOf(
            request.files,
            function (file, index, next) {
                console.log("Received request to store file: " + file.originalname + " length:" + file.size);
                ConverterService.fromFreeplane(file.buffer, function (error, rawmap) {
                    if (error) return appCallback(error);

                    fileService.createNewVersion(user.id, file.originalname, false, null, null, JSON.stringify(rawmap), next);
                });
            },
            function (error) {
                if (error) return appCallback(error);
                response.end();
            })
    });

router.setupDB = function (cassandraOptions) {
    console.log("Setting up DB connection for file service");
    var cassandraClient = new cassandra.Client(cassandraOptions);
    cassandraClient.connect(function (error, ok) {
        if (error) {
            console.error(error);
            throw new Error('Cannot connect to database');
        }
        console.log('Connected to database:' + ok);
        require('../db/storage_schema.es6')(cassandraClient);
        fileService = new FileService(cassandraClient);
    });
};

function ensureAuthenticated(request, response, next) {
    if (request.session.passport.user) {
        user = request.session.passport.user;
        return next(null, request, response);
    }
    next(new ServiceError(401, 'The user has no authentication information', "Authentication failed"));
}

export default router;
