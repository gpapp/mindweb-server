import * as async from "async";
import * as bodyParser from "body-parser";
import * as cassandra from "cassandra-driver";
import * as multer from "multer";
import File from "mindweb-request-classes/dist/classes/File";
import FileContent from "mindweb-request-classes/dist/classes/FileContent";
import ServiceError from "mindweb-request-classes/dist/classes/ServiceError";
import EditAction from "mindweb-request-classes/dist/classes/EditAction";
import BaseRouter from "./BaseRouter";
import FileService from "../services/FileService";
import * as ConverterHelper from "../services/ConverterHelper";
import MapService from "mindweb-request-classes/dist/service/MapService";

const EMPTY_MAP = {
    $: {version: "freeplane 1.3.0"},
    rootNode: {$: {ID: "ID_" + (Math.random() * 10000000000).toFixed()}, nodeMarkdown: 'New map', open: true}
};

const upload: multer.Instance = multer({storage: multer.memoryStorage()});

export default class FileRouter extends BaseRouter {

    constructor(cassandraClient: cassandra.Client) {
        super();

        console.log("Setting up DB connection for file service");
        const fileService: FileService = new FileService(cassandraClient);

        this.router
            .get('/files',  function (request, response, appCallback) {
                fileService.getFiles(request.user.id, function (error, result) {
                    if (error) return appCallback(error);

                    response.json(result);
                    response.end();
                });
            })
            .get('/sharedfiles',  function (request, response, appCallback) {
                fileService.getSharedFiles(request.user.id, function (error, result) {
                    if (error) return appCallback(error);

                    response.json(result);
                    response.end();
                });
            })
            .post('/tagQuery',  bodyParser.json(), function (request, response, appCallback) {
                const fileId = request.body.id;
                const query = request.body.query;
                if (undefined == fileId) {
                    return appCallback(new ServiceError(400, 'MyFile not specified', 'Tag query file'));
                }
                if (undefined == query) {
                    return appCallback(new ServiceError(400, 'Query not specified', 'Tag query file'));
                }
                async.waterfall(
                    [
                        function (next) {
                            fileService.getFile(fileId, next);
                        },
                        function (friend: File, next) {
                            if (friend.owner.toString() != request.user.id.toString()) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            fileService.tagQuery(request.user.id, fileId, query, function (error, result) {
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
            .post('/tag',  bodyParser.json(), function (request, response, appCallback) {
                const fileId = request.body.id;
                const tag = request.body.tag;
                if (undefined == fileId) {
                    return appCallback(new ServiceError(400, 'MyFile not specified', 'Tag file'));
                }
                if (undefined == tag) {
                    return appCallback(new ServiceError(400, 'Tag not specified', 'Tag file'));
                }
                async.waterfall(
                    [
                        function (next) {
                            fileService.getFile(fileId, next);
                        },
                        function (friend: File, next) {
                            if (friend.owner.toString() != request.user.id.toString()) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            fileService.tagFile(fileId, tag, function (error, result) {
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
            .post('/untag',  bodyParser.json(), function (request, response, appCallback) {
                const fileId = request.body.id;
                const tag = request.body.tag;
                if (undefined == fileId) {
                    return appCallback(new ServiceError(400, 'MyFile not specified', 'Untag file'));
                }
                if (undefined == tag) {
                    return appCallback(new ServiceError(400, 'Tag not specified', 'Untag file'));
                }
                async.waterfall(
                    [
                        function (next) {
                            fileService.getFile(fileId, next);
                        },
                        function (friend: File, next) {
                            if (friend.owner.toString() != request.user.id.toString()) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            fileService.untagFile(fileId, tag, function (error, result) {
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
            .delete('/file/:id',  function (request, response, appCallback) {
                const fileId = request.params.id;
                async.waterfall(
                    [
                        function (next) {
                            fileService.getFile(fileId, next);
                        },
                        function (fileInfo, next) {
                            if (!fileInfo.canRemove(request.user.id)) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            fileService.deleteFile(fileId, function (error) {
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
            .post('/rename/:id',  bodyParser.json(), function (request, response, appCallback) {
                const fileId = request.params.id;
                if (!request.body.newName) {
                    return appCallback(new ServiceError(500, 'Service invocation error', 'newName not supplied'))
                }
                const newName = request.body.newName + '.mm';
                async.waterfall(
                    [
                        function (next) {
                            fileService.getFile(fileId, next);
                        },
                        function (fileInfo, next) {
                            if (!fileInfo.canRemove(request.user.id)) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            fileService.renameFile(fileId, newName, function (error) {
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
            .post('/share',  bodyParser.json(), function (request, response, appCallback) {
                const fileId = request.body.fileId;
                const isShareable = request.body.isShareable;
                const isPublic = request.body.isPublic;
                const viewers = request.body.viewers;
                const editors = request.body.editors;
                async.waterfall(
                    [
                        function (next) {
                            fileService.getFile(fileId, next);
                        },
                        function (fileInfo, next) {
                            if (!fileInfo.canRemove(request.user.id)) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            fileService.shareFile(fileId, isShareable, isPublic, viewers, editors, next);
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
            .post('/create',  bodyParser.json(), function (request, response, appCallback) {

                const name = request.body.name + '.mm';
                const isShareable = request.body.isShareable;
                const isPublic = request.body.isPublic;
                const viewers = request.body.viewers;
                const editors = request.body.editors;
                const tags = request.body.tags;
                async.waterfall(
                    [
                        function (next) {
                            fileService.createNewVersion(request.user.id, name, isShareable, isPublic, viewers, editors, tags, JSON.stringify(EMPTY_MAP), next);
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
            .post('/change/:id',  bodyParser.json(), function (request, response, appCallback) {
                const fileId = request.params.id;
                const actions = request.body.actions;
                async.waterfall(
                    [
                        function (next) {
                            fileService.getFile(fileId, next);
                        },
                        function (fileInfo, next) {
                            if (!fileInfo.canEdit(request.user.id)) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            const fileVersionId = fileInfo.versions[0];
                            fileService.getFileVersion(fileVersionId, function (error, fileVersion) {
                                if (error) return appCallback(error);
                                next(null, fileVersionId, fileVersion.content)
                            });
                        },
                        function (fileVersionId, fileContent, next) {
                            async.each(
                                actions,
                                function (action: EditAction, callback) {
                                    MapService.applyAction(fileContent, action, callback);
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

            .post('/upload',  upload.array('files'), function (request, response, appCallback) {
                async.forEachOf(
                    request.files,
                    function (file, index, next) {
                        console.log("Received request to store file: " + file["originalname"] + " length:" + file["size"]);
                        ConverterHelper.fromFreeplane(file["buffer"], function (error, rawmap: FileContent) {
                            if (error) return appCallback(error);

                            fileService.createNewVersion(request.user.id, file["originalname"], true, false, null, null, null,
                                JSON.stringify(rawmap), (error: ServiceError, file: File) => {
                                    if (error) return appCallback(error);
                                    response.write(JSON.stringify(file));
                                    next();
                                });
                        });
                    },
                    function (error) {
                        if (error) return appCallback(error);
                        response.end();
                    })
            });
    }
}

