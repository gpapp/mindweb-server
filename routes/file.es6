import async from 'async';
import express from 'express';
import cassandra from 'cassandra-driver';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import multer from 'multer';

import ServiceError from '../classes/ServiceError.es6';
import FileService from '../services/FileService';
import * as EditorService from '../services/EditorService';
import * as FreeplaneConverterService from '../services/FreeplaneConverterService'

var router = express.Router();
var upload = multer({inMemory: true});

var user;
var fileService;

router.use(bodyParser.json());
router.use(bodyParser.urlencoded({extended: false}));
router.use(cookieParser());

router
    .get('/files', ensureAuthenticated, function (request, response) {
        fileService.getFiles(user.id, function (error, result) {
            if (error) {
                response.statusCode = error.statusCode;
                response.write(error.message);
                response.end();
            } else {
                response.json(result);
                response.end();
            }
        });
    })
    .get('/file/:id', ensureAuthenticated, function (request, response) {
        async.waterfall(
            [
                function (next) {
                    fileService.getFile(request.params.id, next);
                },
                function (result, next) {
                    var fileInfo = result;
                    if (fileInfo.canView(user)) {
                        var lastVersionId = fileInfo.versions[0];
                        fileService.getFileVersion(lastVersionId, function (error, content) {
                            if (error) {
                                next(error);
                            }
                            next(null, content);
                        });
                    } else {
                        next(new ServiceError(401, 'Unauthorized'));
                    }
                },
                function (fileContent, next) {
                    response.json(fileContent);
                    response.end();
                    next();
                }],
            function (error) {
                if (error) {
                    response.statusCode = error.statusCode;
                    response.write(error.message);
                    response.end();
                }
            }
        )
    })
    .put('/change/:id', ensureAuthenticated, bodyParser.json(), function (request, response) {
        var fileId = request.params.id;
        var actions = request.body.actions;
        async.waterfall(
            [
                function (next) {
                    fileService.getFile(fileId, next);
                },
                function (fileInfo, next) {
                    if (!fileInfo.error && fileInfo.canEdit(user)) {
                        var fileVersionId = fileInfo.versions[fileInfo.versions.length - 1];
                        fileService.getFileVersion(fileVersionId, function (error, fileVersion) {
                            if (error) {
                                return next(error);
                            }
                            next(null, fileVersionId, fileVersion.content)
                        });
                    } else if (!fileInfo.error) {
                        next(new ServiceError(401, 'Unauthorized'));
                    } else {
                        next(new ServiceError(500, fileInfo.error));
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
                }
            ],
            function (error) {
                if (error) {
                    response.statusCode = error.statusCode;
                    response.write(error.message);
                } else {
                    response.statusCode = 200;
                }
                response.end();
            }
        )
    })
    .post('/upload', ensureAuthenticated, upload.array('file', 10), function (request, response) {
        async.forEachOf(request.files,
            function (file, index, next) {
                console.log("Received request to store file: " + file.originalname + " length:" + file.size);
                FreeplaneConverterService.convert(file.buffer, function (error, rawmap) {
                    if (error) {
                        next(error);
                    }
                    fileService.createNewVersion(file.originalname, user.id, JSON.stringify(rawmap), next);
                });
            },
            function (err) {
                if (err) {
                    response.status(500);
                    response.render('error', {error: err});
                } else {
                    response.status(200);
                }
                response.end();
            }
        );
    })
;

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
