import * as async from "async";
import * as bodyParser from "body-parser";
import * as cassandra from "cassandra-driver";
import * as multer from "multer";
import {MapContainer} from "mindweb-request-classes";
import {MapContent} from "mindweb-request-classes";
import {ServiceError} from "mindweb-request-classes";
import {EditAction} from "mindweb-request-classes";
import BaseRouter from "./BaseRouter";
import MapContainerService from "../services/MapService";
import * as ConverterHelper from "../services/ConverterHelper";
import MapService from "mindweb-request-classes/service/MapService";

const EMPTY_MAP = {
    $: {version: "freeplane 1.3.0"},
    rootNode: {$: {ID: "ID_" + (Math.random() * 10000000000).toFixed()}, nodeMarkdown: 'New map', open: true}
};

const upload: multer.Instance = multer({storage: multer.memoryStorage()});

export default class MapRouter extends BaseRouter {

    constructor(cassandraClient: cassandra.Client) {
        super();

        console.log("Setting up DB connection for map service");
        const fileService: MapContainerService = new MapContainerService(cassandraClient);

        this.router
            .get('/maps',  (request, response, appCallback) => {
                fileService.getMapContainers(request.user.id, (error, result) => {
                    if (error) return appCallback(error);

                    response.json(result);
                    response.end();
                });
            })
            .get('/sharedMaps',  (request, response, appCallback) => {
                fileService.getSharedMaps(request.user.id, (error, result) => {
                    if (error) return appCallback(error);

                    response.json(result);
                    response.end();
                });
            })
            .post('/tagQuery',  bodyParser.json(), (request, response, appCallback) => {
                const fileId = request.body.id;
                const query = request.body.query;
                if (undefined == fileId) {
                    return appCallback(new ServiceError(400, 'MapContainer not specified', 'Tag query map'));
                }
                if (undefined == query) {
                    return appCallback(new ServiceError(400, 'Query not specified', 'Tag query map'));
                }
                async.waterfall(
                    [
                        (next) => {
                            fileService.getMap(fileId, next);
                        },
                        (friend: MapContainer, next) => {
                            if (friend.owner.toString() != request.user.id.toString()) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            fileService.tagQuery(request.user.id, fileId, query, (error, result) => {
                                if (error) return appCallback(error);
                                next(null, result);
                            });
                        },
                        (tags: string[], next) => {
                            const retval = [];
                            for (let i = 0; i < tags.length; i++) {
                                retval.push({text: tags[i]});
                            }
                            response.json(retval);
                            response.end();
                            next();
                        }
                    ],
                    (error) => {
                        if (error) appCallback(error);
                    });
            })
            .post('/tag',  bodyParser.json(), (request, response, appCallback) => {
                const fileId = request.body.id;
                const tag = request.body.tag;
                if (undefined == fileId) {
                    return appCallback(new ServiceError(400, 'MapContainer not specified', 'Tag map'));
                }
                if (undefined == tag) {
                    return appCallback(new ServiceError(400, 'Tag not specified', 'Tag map'));
                }
                async.waterfall(
                    [
                        (next) => {
                            fileService.getMap(fileId, next);
                        },
                        (friend: MapContainer, next) => {
                            if (friend.owner.toString() != request.user.id.toString()) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            fileService.tagMap(fileId, tag, (error, result) => {
                                if (error) return appCallback(error);
                                next(null, result);
                            });
                        },
                        (friend: MapContainer, next) => {
                            response.json(friend);
                            response.end();
                            next();
                        }
                    ],
                    (error) => {
                        if (error) appCallback(error);
                    });
            })
            .post('/untag',  bodyParser.json(), (request, response, appCallback) => {
                const fileId = request.body.id;
                const tag = request.body.tag;
                if (undefined == fileId) {
                    return appCallback(new ServiceError(400, 'MapContainer not specified', 'Untag map'));
                }
                if (undefined == tag) {
                    return appCallback(new ServiceError(400, 'Tag not specified', 'Untag map'));
                }
                async.waterfall(
                    [
                        (next) => {
                            fileService.getMap(fileId, next);
                        },
                        (friend: MapContainer, next) => {
                            if (friend.owner.toString() != request.user.id.toString()) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            fileService.untagMap(fileId, tag, (error, result) => {
                                if (error) return appCallback(error);
                                next(null, result);
                            });
                        },
                        (friend: MapContainer, next) => {
                            response.json(friend);
                            response.end();
                            next();
                        }
                    ],
                    (error) => {
                        if (error) appCallback(error);
                    });
            })
            .delete('/map/:id',  (request, response, appCallback) => {
                const fileId = request.params.id;
                async.waterfall(
                    [
                        (next) => {
                            fileService.getMap(fileId, next);
                        },
                        (fileInfo, next) => {
                            if (!fileInfo.canRemove(request.user.id)) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            fileService.deleteMap(fileId, (error) => {
                                if (error) return appCallback(error);
                                next(null, fileInfo);
                            });
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
            })
            .post('/rename/:id',  bodyParser.json(), (request, response, appCallback) => {
                const fileId = request.params.id;
                if (!request.body.newName) {
                    return appCallback(new ServiceError(500, 'Service invocation error', 'newName not supplied'))
                }
                const newName = request.body.newName + '.mm';
                async.waterfall(
                    [
                        (next) => {
                            fileService.getMap(fileId, next);
                        },
                        (fileInfo, next) => {
                            if (!fileInfo.canRemove(request.user.id)) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            fileService.renameMap(fileId, newName, (error) => {
                                if (error) return appCallback(error);
                                next(null, fileInfo);
                            });
                        },
                        (fileInfo, next) => {
                            fileInfo.name = newName;
                            response.json(fileInfo);
                            response.end();
                            next();
                        }
                    ],
                    (error) => {
                        if (error) appCallback(error);
                    })
            })
            .post('/share',  bodyParser.json(), (request, response, appCallback) => {
                const fileId = request.body.fileId;
                const isShareable = request.body.isShareable;
                const isPublic = request.body.isPublic;
                const viewers = request.body.viewers;
                const editors = request.body.editors;
                async.waterfall(
                    [
                        (next) => {
                            fileService.getMap(fileId, next);
                        },
                        (fileInfo, next) => {
                            if (!fileInfo.canRemove(request.user.id)) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            fileService.shareMap(fileId, isShareable, isPublic, viewers, editors, next);
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
            })
            .post('/create',  bodyParser.json(), (request, response, appCallback) => {

                const name = request.body.name + '.mm';
                const isShareable = request.body.isShareable;
                const isPublic = request.body.isPublic;
                const viewers = request.body.viewers;
                const editors = request.body.editors;
                const tags = request.body.tags;
                async.waterfall(
                    [
                        (next) => {
                            fileService.createNewVersion(request.user.id, name, isShareable, isPublic, viewers, editors, tags, JSON.stringify(EMPTY_MAP), next);
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
            })
            .post('/change/:id',  bodyParser.json(), (request, response, appCallback) => {
                const fileId = request.params.id;
                const actions = request.body.actions;
                async.waterfall(
                    [
                        (next) => {
                            fileService.getMap(fileId, next);
                        },
                        (fileInfo, next) => {
                            if (!fileInfo.canEdit(request.user.id)) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            const fileVersionId = fileInfo.versions[0];
                            fileService.getMapVersion(fileVersionId, (error, fileVersion) => {
                                if (error) return appCallback(error);
                                next(null, fileVersionId, fileVersion.content)
                            });
                        },
                        (fileVersionId, fileContent, next) => {
                            async.each(
                                actions,
                                (action: EditAction, callback) => {
                                    MapService.applyAction(fileContent, action, callback);
                                },
                                (error) => {
                                    if (error) {
                                        console.error("Error applying action: " + error);
                                    }
                                    next(null, fileVersionId, fileContent);
                                }
                            );
                        },
                        (fileVersionId, fileContent, next) => {
                            fileService.updateMapVersion(fileVersionId, JSON.stringify(fileContent), next);
                        },
                        (result, next) => {
                            response.end();
                            next();
                        }
                    ],
                    (error) => {
                        if (error) appCallback(error);
                    })
            })

            .post('/upload',  upload.array('files'), (request, response, appCallback) => {
                async.forEachOf(
                    request.files,
                    (file, index, next) => {
                        console.log("Received request to store map: " + file["originalname"] + " length:" + file["size"]);
                        ConverterHelper.fromFreeplane(file["buffer"], (error, rawmap: MapContent) => {
                            if (error) return appCallback(error);

                            fileService.createNewVersion(request.user.id, file["originalname"], true, false, null, null, null,
                                JSON.stringify(rawmap), (error: ServiceError, file: MapContainer) => {
                                    if (error) return appCallback(error);
                                    response.write(JSON.stringify(file));
                                    next();
                                });
                        });
                    },
                    (error) => {
                        if (error) return appCallback(error);
                        response.end();
                    })
            });
    }
}

