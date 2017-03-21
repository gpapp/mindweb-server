import * as async from "async";
import MapContainer from "mindweb-request-classes";
import ServiceError from "mindweb-request-classes";
import MapVersion from "mindweb-request-classes";
import MapContent from "mindweb-request-classes";
import MapContainerDAO from "../dao/MapContainerDAO";
import MapVersionDAO from "../dao/MapVersionDAO";
import * as cassandra from "cassandra-driver";
import * as FilterHelper from "./FilterHelper";

export default class FileService {
    private connection;
    private _mapDAO: MapContainerDAO;
    private _mapVersionDAO: MapVersionDAO;

    constructor(connection) {
        this.connection = connection
    }

    get mapDAO(): MapContainerDAO {
        if (this._mapDAO == null) {
            this._mapDAO = new MapContainerDAO(this.connection);
        }
        return this._mapDAO;
    }

    get mapVersionDAO(): MapVersionDAO {
        if (this._mapVersionDAO == null) {
            this._mapVersionDAO = new MapVersionDAO(this.connection);
        }
        return this._mapVersionDAO;
    }

    // TODO: this is ugly, all tags are collected from the entire DB, and then collected in JS
    public getPublicFileTags(query: string,
                             callback: (error: ServiceError, tagCloud?: Object) => void) {
        this.mapDAO.getPublicFileTags(function (error: ServiceError, result: cassandra.types.ResultSet) {
            if (error) return callback(error);
            let tags: string[] = [];
            for (let i = 0; i < result.rows.length; i++) {
                tags = tags.concat(result.rows[i]['tags']);
            }
            tags = tags.filter(FilterHelper.queryFilter(query));
            const tagCloud = {};
            for (let i = 0; i < tags.length; i++) {
                tagCloud[tags[i]] = (tagCloud[tags[i]] == undefined ? 1 : tagCloud[tags[i]] + 1);
            }
            callback(null, tagCloud);
        })
    }

    public getPublicMapsForTags(query: string, tags: string[], callback: (error: ServiceError, result?: MapContainer[]) => void) {
        const parent: FileService = this;
        async.waterfall([
            function (waterNext: (error: ServiceError, result?: MapContainer[]) => void) {
                if (tags.length == 0) {
                    parent.mapDAO.getPublicFiles(function (error: ServiceError, result: cassandra.types.ResultSet) {
                        if (error) {
                            return callback(error, null);
                        }
                        const retval: MapContainer[] = [];
                        for (let i = 0; i < result.rows.length; i++) {
                            retval.push(mapFromRow(result.rows[i]));
                        }
                        waterNext(null, retval);
                    });
                } else {
                    const retval: MapContainer[] = [];
                    async.each(tags, function (tag: string, next: () => void) {
                            parent.mapDAO.getPublicFilesForTag(tag, function (error: ServiceError, result: cassandra.types.ResultSet) {
                                if (error) {
                                    return callback(error, null);
                                }
                                for (let i = 0; i < result.rows.length; i++) {
                                    const row = result.rows[i];
                                    const fileFrom: MapContainer = mapFromRow(row);
                                    if (fileFrom.isPublic) {
                                        retval.push(fileFrom);
                                    }
                                }
                                next();
                            });
                        },
                        function (error: ServiceError) {
                            if (error) return callback(error);
                            waterNext(null, retval);
                        }
                    )
                }
            },
            function (retval: MapContainer[], next) {
                retval =
                    retval
                        .filter(FilterHelper.uniqueFilterFile)
                        .filter(FilterHelper.queryFilterFile(query))
                        .filter(function (v: MapContainer) {
                            if (v.tags == null) {
                                return tags.length == 0;
                            }
                            if (v.tags.length < tags.length) {
                                return false;
                            }
                            for (let i = 0; i < tags.length; i++) {
                                let found = false;
                                for (let j = 0; j < v.tags.length; j++) {
                                    if (v.tags[j].toLowerCase() === tags[i].toLowerCase()) {
                                        found = true;
                                        break;
                                    }
                                }
                                if (!found) {
                                    return false;
                                }
                            }
                            return true;
                        });
                callback(null, retval);
            }
        ]);
    }

    public getMapContainers(userId: string|cassandra.types.Uuid, callback: (error: ServiceError, result?: MapContainer[]) => void) {
        this.mapDAO.getFiles(userId, function (error: ServiceError, result: cassandra.types.ResultSet) {
            if (error) {
                return callback(error, null);
            }
            const retval: MapContainer[] = new Array(result.rows.length);
            for (let i = 0; i < result.rows.length; i++) {
                retval[i] = mapFromRow(result.rows[i]);
            }
            callback(null, retval);
        });
    }

    public getSharedMaps(userId: string|cassandra.types.Uuid, callback: (error: ServiceError, result?: MapContainer[]) => void) {
        const parent: FileService = this;
        const retval: MapContainer[] = [];
        async.parallel([
            function (next: Function) {
                parent.mapDAO.getSharedFilesForEdit(userId, function (error: ServiceError, result: cassandra.types.ResultSet) {
                    if (error) {
                        return callback(error, null);
                    }
                    for (let i = 0; i < result.rows.length; i++) {
                        retval.push(mapFromRow(result.rows[i]));
                    }

                    next();
                })
            },
            function (next: Function) {
                parent.mapDAO.getSharedFilesForView(userId, function (error: ServiceError, result: cassandra.types.ResultSet) {
                    if (error) {
                        return callback(error, null);
                    }
                    for (let i = 0; i < result.rows.length; i++) {
                        retval.push(mapFromRow(result.rows[i]));
                    }

                    next();
                })
            },
        ], function () {
            callback(null, retval);
        });
    }

    public getMap(fileId: string|cassandra.types.Uuid, callback: (error: ServiceError, result?: MapContainer) => void) {
        this.mapDAO.getFile(fileId, function (error: ServiceError, result: cassandra.types.ResultSet) {
            if (error) return callback(error);

            const row = result.first();
            if (row == null) {
                return callback(new ServiceError(403, 'No such mapDAO version by that id', "getMap"));
            }
            callback(null, mapFromRow(row));
        });
    }

    public deleteMap(fileId: string|cassandra.types.Uuid, callback: (error: ServiceError, result?: string) => void) {
        const parent: FileService = this;

        this.mapDAO.getFile(fileId, function (error: ServiceError, result: cassandra.types.ResultSet) {
            if (error) return callback(error);
            if (result.rows.length > 0) {
                async.each(result.rows[0]["versions"], function (fileVersionId: string|cassandra.types.Uuid, next: (error?: ServiceError) => void) {
                    parent.mapVersionDAO.deleteById(fileVersionId, function () {
                        next();
                    });
                }, function (error: ServiceError) {
                    if (error) {
                        return callback(error);
                    }
                    parent.mapDAO.deleteById(fileId, function (error: ServiceError) {
                        if (error) {
                            return callback(error);
                        }
                        callback(null, 'OK');
                    });
                });
            }
            else {
                callback(new ServiceError(403, 'FileService not found', 'deleteMap'));
            }
        });
    }

    public renameMap(fileId: string|cassandra.types.Uuid, newFileName: string, callback: (error: ServiceError, result?: MapContainer) => void) {
        const parent: FileService = this;
        // TODO: Check filename availibility
        this.mapDAO.renameById(fileId, newFileName, function (error: ServiceError) {
            if (error) return callback(error);
            parent.getMap(fileId, callback);
        });
    }

    public getMapVersion(fileVersionId: string|cassandra.types.Uuid, callback: (error: ServiceError, file?: MapVersion) => void) {
        this.mapVersionDAO.getContent(fileVersionId, function (error: ServiceError, result: cassandra.types.ResultSet) {
            if (error) return callback(error, null);
            const row = result.first();
            if (row != null) {
                callback(null, new MapVersion(row["version"], new MapContent(row["content"])));
            }
            else {
                callback(new ServiceError(403, 'No such mapDAO version by that id', 'getMapVersion'));
            }
        });
    }

    public createNewVersion(userId: string|cassandra.types.Uuid,
                            fileName: string,
                            isShareable: boolean,
                            isPublic: boolean,
                            viewers: string[]|cassandra.types.Uuid[],
                            editors: string[]|cassandra.types.Uuid[],
                            tags: string[],
                            content: string,
                            callback: (error: ServiceError, result?: MapContainer) => void) {
        const parent: FileService = this;
        async.waterfall([
                function (next: (error: ServiceError, fileId?: cassandra.types.Uuid, versions?: cassandra.types.Uuid[]) => void) {
                    parent.mapDAO.getFileByUserAndName(userId, fileName, function (error: ServiceError, result: cassandra.types.ResultSet) {
                        if (error) return callback(error);
                        let fileId: cassandra.types.Uuid;
                        let versions: cassandra.types.Uuid[];
                        if (result.rows.length > 0) {
                            fileId = result.rows[0]["id"];
                            versions = result.rows[0]["versions"];
                        }
                        else {
                            fileId = cassandra.types.Uuid.random();
                            versions = [];
                        }
                        next(null, fileId, versions);
                    });
                },
                function (fileId: cassandra.types.Uuid, versions: cassandra.types.Uuid[],
                          next: (error: ServiceError, file: File, fileId?: cassandra.types.Uuid, versions?: cassandra.types.Uuid[]) => void) {
                    if (versions.length > 0) {
                        parent.getMap(fileId, function (error: ServiceError, file: MapContainer) {
                            if (error) return callback(error);
                            next(null, file, fileId, versions);
                        });
                    } else {
                        next(null, null, fileId, versions);
                    }
                },
                function (file: File, fileId: cassandra.types.Uuid, versions: cassandra.types.Uuid[],
                          next: (error: ServiceError, file: File, fileId: cassandra.types.Uuid, versions: cassandra.types.Uuid[]) => void) {
                    const newFileVersionId: cassandra.types.Uuid = cassandra.types.Uuid.random();
                    if (file) {
                        const oldFileVersionId = versions[0];
                        parent.mapVersionDAO.getContent(oldFileVersionId, function (error: ServiceError, result: cassandra.types.ResultSet) {
                            if (error) return callback(error);
                            const row = result.first();
                            if (content === row["content"]) {
                                next(null, file, fileId, versions);
                            }
                            else {
                                parent.mapVersionDAO.createNewVersion(newFileVersionId, versions.length + 1, content,
                                    function (error: ServiceError) {
                                        if (error) return callback(error);
                                        versions.unshift(newFileVersionId);
                                        next(null, file, fileId, versions);
                                    });
                            }
                        });
                    }
                    else {
                        parent.mapVersionDAO.createNewVersion(newFileVersionId, versions.length + 1, content,
                            function (error: ServiceError) {
                                if (error) return callback(error);
                                versions.unshift(newFileVersionId);
                                next(null, null, fileId, versions);
                            });
                    }
                },
                function (file: MapContainer, fileId: cassandra.types.Uuid, versions: cassandra.types.Uuid[], next: (error: ServiceError, fileId?: cassandra.types.Uuid) => void) {
                    if (file) {
                        parent.mapDAO.updateFile(fileId,
                            isShareable, isPublic, viewers ? viewers : file.viewers, editors ? editors : file.editors,
                            versions, tags ? tags : file.tags,
                            function (error: ServiceError) {
                                if (error) return callback(error);
                                next(null, fileId);
                            });
                    }
                    else {
                        parent.mapDAO.createFile(fileId, fileName, userId, isShareable, isPublic, viewers, editors, versions, tags, function (error: ServiceError) {
                            if (error) return callback(error);
                            next(null, fileId);
                        });
                    }
                },
                function (fileId: cassandra.types.Uuid) {
                    parent.getMap(fileId, callback);
                }
            ]
        );
    }

    public updateMapVersion(fileId: string|cassandra.types.Uuid,
                            content: string,
                            callback: (error: ServiceError, result?: string) => void) {
        this.mapVersionDAO.updateVersion(fileId, content, function (error: ServiceError) {
            callback(error, 'OK');
        });
    }

    public shareMap(fileId: string|cassandra.types.Uuid,
                    isShareable: boolean,
                    isPublic: boolean,
                    viewers: (string|cassandra.types.Uuid)[],
                    editors: (string|cassandra.types.Uuid)[],
                    callback: (error: ServiceError, result?: MapContainer) => void) {
        const parent: FileService = this;
        async.waterfall([
                function (next: (error: ServiceError, file?: MapContainer) => void) {
                    parent.getMap(fileId, function (error: ServiceError, result: MapContainer) {
                        if (error) return callback(error);
                        if (result == null) {
                            return callback(new ServiceError(500, 'Trying to share non-existing mapDAO', "MyFile share error"));
                        }
                        next(null, result);
                    });
                },
                function (file: MapContainer) {
                    if (viewers) {
                        viewers = viewers.filter(FilterHelper.uniqueFilter);
                    }
                    if (editors) {
                        editors = editors.filter(FilterHelper.uniqueFilter);
                    }
                    if (viewers && editors) {
                        for (let i in viewers) {
                            const curV = viewers[i].toString();
                            for (let j in editors) {
                                if (editors[j].toString() === curV) {
                                    viewers.splice(viewers.indexOf(i), 1);
                                }
                            }
                        }
                    }
                    parent.mapDAO.shareFile(fileId, isShareable, isPublic, viewers, editors, function (error: ServiceError) {
                        if (error) return callback(error);
                        parent.getMap(fileId, callback);
                    });
                }
            ]
        );
    }

    public tagQuery(userId: string|cassandra.types.Uuid,
                    fileId: string|cassandra.types.Uuid,
                    query: string,
                    callback: (error: ServiceError, result?: string[]) => void) {
        const parent: FileService = this;
        async.waterfall([
            function (next: (error: ServiceError, file?: MapContainer) => void) {
                if (fileId == null) {
                    return next(null, null);
                }
                parent.getMap(fileId, function (error: ServiceError, result: MapContainer) {
                    if (error) return next(error, null);
                    next(null, result);
                });
            },
            function (file: File, next: (error: ServiceError, tags?: string[], file?: MapContainer) => void) {
                parent.mapDAO.tagQuery(userId, function (error: ServiceError, result: cassandra.types.ResultSet) {
                    if (error) return callback(error);
                    let retval: string[] = [];
                    for (let i = 0; i < result.rows.length; i++) {
                        retval = retval.concat(result.rows[i]['tags']);
                    }
                    next(null, retval, MapContainer);
                })
            },
            function (tags: string[], file: MapContainer) {
                if (file != null && file.tags != null) {
                    tags = tags.filter(FilterHelper.exceptFilter(file.tags));
                }
                tags.unshift(query);
                callback(null, tags.filter(FilterHelper.uniqueFilter).filter(FilterHelper.queryFilter(query)));
            },
        ]);
    }

    public tagMap(fileId: string|cassandra.types.Uuid, tag: string, callback: (error: ServiceError, result?: MapContainer) => void) {
        const parent: FileService = this;
        if (tag == null) {
            return callback(new ServiceError(500, 'Cannot add null tag', 'Error MyFile tagging'));
        }
        async.waterfall([
            function (next: (error: ServiceError, result?: MapContainer) => void) {
                parent.getMap(fileId, function (error: ServiceError, result: MapContainer) {
                    if (error) return callback(error);
                    next(null, result)
                })
            },
            function (file: File, next) {
                parent.mapDAO.tagFile(fileId, tag, function (error: ServiceError, result: cassandra.types.ResultSet) {
                    if (error) return callback(error);
                    parent.getMap(fileId, callback);
                })
            }]);
    }

    public untagMap(fileId: string|cassandra.types.Uuid, tag: string, callback: (error: ServiceError, result?: MapContainer) => void) {
        const parent: FileService = this;
        if (tag == null) {
            return callback(new ServiceError(500, 'Cannot remove null tag', 'Error MyFile untagging'));
        }
        async.waterfall([
            function (next: (error: ServiceError, result?: MapContainer) => void) {
                parent.getMap(fileId, function (error: ServiceError, result: MapContainer) {
                    if (error) return callback(error);
                    next(null, result)
                })
            },
            function (file: MapContainer) {
                parent.mapDAO.untagFile(fileId, tag, function (error: ServiceError, result: cassandra.types.ResultSet) {
                    if (error) return callback(error);
                    parent.getMap(fileId, callback);
                })
            }]);
    }
}

function mapFromRow(row) {
    return new MapContainer(row['id'], row['name'], row['owner'], row['viewers'], row['editors'], row['shareable'], row['public'], row['versions'], row['tags']);
}
