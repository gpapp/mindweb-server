import * as async from 'async';
import * as bodyParser from 'body-parser';
import * as cassandra from 'cassandra-driver';
import * as multer from "multer";

import File from '../classes/File';
import ServiceError from '../classes/ServiceError';
import EditAction from "../classes/EditAction";

import BaseRouter from './BaseRouter';
import FileService from '../services/FileService';
import * as EditorHelper from '../services/EditorHelper';
import * as ConverterHelper from '../services/ConverterHelper'
import FileContent from "../classes/FileContent";


const EMPTY_MAP = {
    $: {version: "freeplane 1.3.0"},
    rootNode: {$: {ID: "ID_" + (Math.random() * 10000000000).toFixed()}, nodeMarkdown: 'New map', open: true}
};

const upload = multer({storage: multer.memoryStorage()});

export default class FileRouter extends BaseRouter {
    private fileService: FileService;

    constructor(cassandraClient: cassandra.Client) {
        super();

        console.log("Setting up DB connection for file service");
        this.fileService = new FileService(cassandraClient);

        this.router
            .get('/files', BaseRouter.ensureAuthenticated, function (request, response, appCallback) {
                this.fileService.getFiles(request.user.id, function (error, result) {
                    if (error) return appCallback(error);

                    response.json(result);
                    response.end();
                });
            })
            .get('/sharedfiles', BaseRouter.ensureAuthenticated, function (request, response, appCallback) {
                this.fileService.getSharedFiles(request.user.id, function (error, result) {
                    if (error) return appCallback(error);

                    response.json(result);
                    response.end();
                });
            })
            .put('/tagQuery', BaseRouter.ensureAuthenticated, bodyParser.json(), function (request, response, appCallback) {
                const fileId = request.body.id;
                const query = request.body.query;
                if (undefined == fileId) {
                    return appCallback(new ServiceError(400, 'File not specified', 'Tag query file'));
                }
                if (undefined == query) {
                    return appCallback(new ServiceError(400, 'Query not specified', 'Tag query file'));
                }
                async.waterfall(
                    [
                        function (next) {
                            this.fileService.getFile(fileId, next);
                        },
                        function (friend: File, next) {
                            if (friend.owner.toString() != request.user.id.toString()) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            this.fileService.tagQuery(request.user.id, fileId, query, function (error, result) {
                                if (error) return appCallback(error);
                                next(null, result);
                            });
                        },
                        function (tags: string[], next) {
                            const retval = [];
                            for (let i = 0; i < tags.length; i++) {
                                retval.push({text: tags[i]});
                            }
                            response.json(retval);
                            response.end();
                            next();
                        }
                    ],
                    function (error) {
                        if (error) appCallback(error);
                    });
            })
            .put('/tag', BaseRouter.ensureAuthenticated, bodyParser.json(), function (request, response, appCallback) {
                const fileId = request.body.id;
                const tag = request.body.tag;
                if (undefined == fileId) {
                    return appCallback(new ServiceError(400, 'File not specified', 'Tag file'));
                }
                if (undefined == tag) {
                    return appCallback(new ServiceError(400, 'Tag not specified', 'Tag file'));
                }
                async.waterfall(
                    [
                        function (next) {
                            this.fileService.getFile(fileId, next);
                        },
                        function (friend: File, next) {
                            if (friend.owner.toString() != request.user.id.toString()) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            this.fileService.tagFile(fileId, tag, function (error, result) {
                                if (error) return appCallback(error);
                                next(null, result);
                            });
                        },
                        function (friend: File, next) {
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
                const fileId = request.body.id;
                const tag = request.body.tag;
                if (undefined == fileId) {
                    return appCallback(new ServiceError(400, 'File not specified', 'Untag file'));
                }
                if (undefined == tag) {
                    return appCallback(new ServiceError(400, 'Tag not specified', 'Untag file'));
                }
                async.waterfall(
                    [
                        function (next) {
                            this.fileService.getFile(fileId, next);
                        },
                        function (friend: File, next) {
                            if (friend.owner.toString() != request.user.id.toString()) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            this.fileService.untagFile(fileId, tag, function (error, result) {
                                if (error) return appCallback(error);
                                next(null, result);
                            });
                        },
                        function (friend: File, next) {
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
                const fileId = request.params.id;
                async.waterfall(
                    [
                        function (next) {
                            this.fileService.getFile(fileId, next);
                        },
                        function (fileInfo, next) {
                            if (!fileInfo.canRemove(request.user.id)) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            this.fileService.deleteFile(fileId, function (error, result) {
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
                const fileId = request.params.id;
                const newName = request.body.newName + '.mm';
                async.waterfall(
                    [
                        function (next) {
                            this.fileService.getFile(fileId, next);
                        },
                        function (fileInfo, next) {
                            if (!fileInfo.canRemove(request.user.id)) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            this.fileService.renameFile(fileId, newName, function (error, result) {
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
            .put('/share', BaseRouter.ensureAuthenticated, bodyParser.json(), function (request, response, appCallback) {
                const fileId = request.body.fileId;
                const isShareable = request.body.isShareable;
                const isPublic = request.body.isPublic;
                const viewers = request.body.viewers;
                const editors = request.body.editors;
                async.waterfall(
                    [
                        function (next) {
                            this.fileService.getFile(fileId, next);
                        },
                        function (fileInfo, next) {
                            if (!fileInfo.canRemove(request.user.id)) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            this.fileService.shareFile(fileId, isShareable, isPublic, viewers, editors, next);
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
            .post('/create', BaseRouter.ensureAuthenticated, bodyParser.json(), function (request, response, appCallback) {

                const name = request.body.name + '.mm';
                const isShareable = request.body.isShareable;
                const isPublic = request.body.isPublic;
                const viewers = request.body.viewers;
                const editors = request.body.editors;
                const tags = request.body.tags;
                async.waterfall(
                    [
                        function (next) {
                            this.fileService.createNewVersion(request.user.id, name, isShareable, isPublic, viewers, editors, tags, JSON.stringify(EMPTY_MAP), next);
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
                const fileId = request.params.id;
                const actions = request.body.actions;
                async.waterfall(
                    [
                        function (next) {
                            this.fileService.getFile(fileId, next);
                        },
                        function (fileInfo, next) {
                            if (!fileInfo.canEdit(request.user.id)) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            const fileVersionId = fileInfo.versions[0];
                            this.fileService.getFileVersion(fileVersionId, function (error, fileVersion) {
                                if (error) return appCallback(error);
                                next(null, fileVersionId, fileVersion.content)
                            });
                        },
                        function (fileVersionId, fileContent, next) {
                            async.each(
                                actions,
                                function (action: EditAction, callback) {
                                    EditorHelper.applyAction(fileContent, action, callback);
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
                            this.fileService.updateFileVersion(fileVersionId, JSON.stringify(fileContent), next);
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
                const fileId = request.params.id;
                async.waterfall(
                    [
                        function (next) {
                            this.fileService.getFile(fileId, next);
                        },
                        function (fileInfo, next) {
                            if (!fileInfo.canView(request.user.id)) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            const fileVersionId = fileInfo.versions[0];
                            this.fileService.getFileVersion(fileVersionId, function (error, fileVersion) {
                                if (error) return appCallback(error);
                                next(null, fileInfo, fileVersion)
                            });
                        },
                        function (fileInfo, fileVersion, next) {
                            ConverterHelper.toFreeplane(fileVersion.content, function (error, result) {
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
                        console.log("Received request to store file: " + file["originalname"] + " length:" + file["size"]);
                        ConverterHelper.fromFreeplane(file["buffer"], function (error, rawmap: FileContent) {
                            if (error) return appCallback(error);

                            this.fileService.createNewVersion(request.user.id, file["originalname"], true, false, null, null, null, JSON.stringify(rawmap), next);
                        });
                    },
                    function (error) {
                        if (error) return appCallback(error);
                        response.end();
                    })
            });
    }
}

