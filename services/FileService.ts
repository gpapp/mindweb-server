import * as async from "async";
import File from "../classes/File";
import ServiceError from "../classes/ServiceError";
import FileVersion from "../classes/FileVersion";
import FileDAO from "../dao/File";
import FileVersionDAO from "../dao/FileVersion";
import * as cassandra from "cassandra-driver";
import * as FilterHelper from "./FilterHelper";
import FileContent from "../classes/FileContent";

export default class FileService {
    private connection;
    private _file:FileDAO;
    private _fileVersion:FileVersionDAO;

    constructor(connection) {
        this.connection = connection
    }

    get file():FileDAO {
        if (this._file == null) {
            this._file = new FileDAO(this.connection);
        }
        return this._file;
    }

    get fileVersion():FileVersionDAO {
        if (this._fileVersion == null) {
            this._fileVersion = new FileVersionDAO(this.connection);
        }
        return this._fileVersion;
    }

    // TODO: this is ugly, all tags are collected from the entire DB, and then collected in JS
    public getPublicFileTags(query:string,
                             callback:(error:ServiceError, tagCloud?:Object)=>void) {
        this.file.getPublicFileTags(function (error:ServiceError, result:cassandra.types.ResultSet) {
            if (error) return callback(error);
            var tags:string[] = [];
            for (var i = 0; i < result.rows.length; i++) {
                tags = tags.concat(result.rows[i]['tags']);
            }
            tags = tags.filter(FilterHelper.queryFilter(query));
            var tagCloud = {};
            for (var i = 0; i < tags.length; i++) {
                tagCloud[tags[i]] = (tagCloud[tags[i]] == undefined ? 1 : tagCloud[tags[i]] + 1);
            }
            callback(null, tagCloud);
        })
    }

    public getPublicFilesForTags(query:string, tags:string[], callback:(error:ServiceError, result?:File[])=>void) {
        var parent:FileService = this;
        async.waterfall([
            function (waterNext:(error:ServiceError, result?:File[])=>void) {
                if (tags.length == 0) {
                    parent.file.getPublicFiles(function (error:ServiceError, result:cassandra.types.ResultSet) {
                        if (error) {
                            return callback(error, null);
                        }
                        var retval:File[] = [];
                        for (var i = 0; i < result.rows.length; i++) {
                            retval.push(fileFromRow(result.rows[i]));
                        }
                        waterNext(null, retval);
                    });
                } else {
                    var retval:File[] = [];
                    async.each(tags, function (tag:string, next:()=>void) {
                            parent.file.getPublicFilesForTag(tag, function (error:ServiceError, result:cassandra.types.ResultSet) {
                                if (error) {
                                    return callback(error, null);
                                }
                                for (var i = 0; i < result.rows.length; i++) {
                                    var row = result.rows[i];
                                    var fileFrom:File = fileFromRow(row);
                                    if (fileFrom.isPublic) {
                                        retval.push(fileFrom);
                                    }
                                }
                                next();
                            });
                        },
                        function (error:ServiceError) {
                            if (error) return callback(error);
                            waterNext(null, retval);
                        }
                    )
                }
            },
            function (retval:File[], next) {
                retval =
                    retval
                        .filter(FilterHelper.uniqueFilterFile)
                        .filter(FilterHelper.queryFilterFile(query))
                        .filter(function (v:File) {
                            if (v.tags == null) {
                                return tags.length == 0;
                            }
                            if (v.tags.length < tags.length) {
                                return false;
                            }
                            for (var i = 0; i < tags.length; i++) {
                                var found = false;
                                for (var j = 0; j < v.tags.length; j++) {
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

    public getFiles(userId:string|cassandra.types.Uuid, callback:(error:ServiceError, result?:File[])=>void) {
        this.file.getFiles(userId, function (error:ServiceError, result:cassandra.types.ResultSet) {
            if (error) {
                return callback(error, null);
            }
            var retval:File[] = new Array(result.rows.length);
            for (var i = 0; i < result.rows.length; i++) {
                retval[i] = fileFromRow(result.rows[i]);
            }
            callback(null, retval);
        });
    }

    public getSharedFiles(userId:string|cassandra.types.Uuid, callback:(error:ServiceError, result?:File[])=>void) {
        var parent:FileService = this;
        var retval:File[] = [];
        async.parallel([
            function (next:Function) {
                parent.file.getSharedFilesForEdit(userId, function (error:ServiceError, result:cassandra.types.ResultSet) {
                    if (error) {
                        return callback(error, null);
                    }
                    for (var i = 0; i < result.rows.length; i++) {
                        retval.push(fileFromRow(result.rows[i]));
                    }

                    next();
                })
            },
            function (next:Function) {
                parent.file.getSharedFilesForView(userId, function (error:ServiceError, result:cassandra.types.ResultSet) {
                    if (error) {
                        return callback(error, null);
                    }
                    for (var i = 0; i < result.rows.length; i++) {
                        retval.push(fileFromRow(result.rows[i]));
                    }

                    next();
                })
            },
        ], function () {
            callback(null, retval);
        });
    }

    public getFile(fileId:string|cassandra.types.Uuid, callback:(error:ServiceError, result?:File)=>void) {
        this.file.getFile(fileId, function (error:ServiceError, result:cassandra.types.ResultSet) {
            if (error) return callback(error);

            var row = result.first();
            if (row == null) {
                return callback(new ServiceError(403, 'No such file version by that id', "getFile"));
            }
            callback(null, fileFromRow(row));
        });
    }

    public deleteFile(fileId:string|cassandra.types.Uuid, callback:(error:ServiceError, result?:string)=>void) {
        var parent:FileService = this;

        this.file.getFile(fileId, function (error:ServiceError, result:cassandra.types.ResultSet) {
            if (error) return callback(error);
            if (result.rows.length > 0) {
                async.each(result.rows[0]["versions"], function (fileVersionId:string|cassandra.types.Uuid, next:(error?:ServiceError)=>void) {
                    parent.fileVersion.deleteById(fileVersionId, function () {
                        next();
                    });
                }, function (error:ServiceError) {
                    if (error) {
                        return callback(error);
                    }
                    parent.file.deleteById(fileId, function (error:ServiceError) {
                        if (error) {
                            return callback(error);
                        }
                        callback(null, 'OK');
                    });
                });
            }
            else {
                callback(new ServiceError(403, 'FileService not found', 'deleteFile'));
            }
        });
    }

    public renameFile(fileId:string|cassandra.types.Uuid, newFileName:string, callback:(error:ServiceError, result?:File)=>void) {
        var parent:FileService = this;
        // TODO: Check filename availibility
        this.file.renameById(fileId, newFileName, function (error:ServiceError) {
            if (error) return callback(error);
            parent.getFile(fileId, callback);
        });
    }

    public getFileVersion(fileVersionId:string|cassandra.types.Uuid, callback:(error:ServiceError, file?:FileVersion)=>void) {
        this.fileVersion.getContent(fileVersionId, function (error:ServiceError, result:cassandra.types.ResultSet) {
            if (error) return callback(error, null);
            var row = result.first();
            if (row != null) {
                callback(null, new FileVersion(row["version"], new FileContent(row["content"])));
            }
            else {
                callback(new ServiceError(403, 'No such file version by that id', 'getFileVersion'));
            }
        });
    }

    public createNewVersion(userId:string|cassandra.types.Uuid,
                            fileName:string,
                            isShareable:boolean,
                            isPublic:boolean,
                            viewers:string[]|cassandra.types.Uuid[],
                            editors:string[]|cassandra.types.Uuid[],
                            tags:string[],
                            content:string,
                            callback:(error:ServiceError, result?:File) => void) {
        var parent:FileService = this;
        async.waterfall([
                function (next:(error:ServiceError, fileId?:cassandra.types.Uuid, versions?:cassandra.types.Uuid[]) => void) {
                    parent.file.getFileByUserAndName(userId, fileName, function (error:ServiceError, result:cassandra.types.ResultSet) {
                        if (error) return callback(error);
                        var fileId:cassandra.types.Uuid;
                        var versions:cassandra.types.Uuid[];
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
                function (fileId:cassandra.types.Uuid, versions:cassandra.types.Uuid[],
                          next:(error:ServiceError, file:File, fileId?:cassandra.types.Uuid, versions?:cassandra.types.Uuid[])=>void) {
                    if (versions.length > 0) {
                        parent.getFile(fileId, function (error:ServiceError, file:File) {
                            if (error) return callback(error);
                            next(null, file, fileId, versions);
                        });
                    } else {
                        next(null, null, fileId, versions);
                    }
                },
                function (file:File, fileId:cassandra.types.Uuid, versions:cassandra.types.Uuid[],
                          next:(error:ServiceError, file:File, fileId:cassandra.types.Uuid, versions:cassandra.types.Uuid[])=>void) {
                    var newFileVersionId:cassandra.types.Uuid = cassandra.types.Uuid.random();
                    if (file) {
                        var oldFileVersionId = versions[0];
                        parent.fileVersion.getContent(oldFileVersionId, function (error:ServiceError, result:cassandra.types.ResultSet) {
                            if (error) return callback(error);
                            var row = result.first();
                            if (content === row["content"]) {
                                next(null, file, fileId, versions);
                            }
                            else {
                                parent.fileVersion.createNewVersion(newFileVersionId, versions.length + 1, content,
                                    function (error:ServiceError) {
                                        if (error) return callback(error);
                                        versions.unshift(newFileVersionId);
                                        next(null, file, fileId, versions);
                                    });
                            }
                        });
                    }
                    else {
                        parent.fileVersion.createNewVersion(newFileVersionId, versions.length + 1, content,
                            function (error:ServiceError) {
                                if (error) return callback(error);
                                versions.unshift(newFileVersionId);
                                next(null, null, fileId, versions);
                            });
                    }
                },
                function (file:File, fileId:cassandra.types.Uuid, versions:cassandra.types.Uuid[], next:(error:ServiceError, fileId?:cassandra.types.Uuid)=>void) {
                    if (file) {
                        parent.file.updateFile(fileId,
                            isShareable, isPublic, viewers ? viewers : file.viewers, editors ? editors : file.editors,
                            versions, tags ? tags : file.tags,
                            function (error:ServiceError) {
                                if (error) return callback(error);
                                next(null, fileId);
                            });
                    }
                    else {
                        parent.file.createFile(fileId, fileName, userId, isShareable, isPublic, viewers, editors, versions, tags, function (error:ServiceError) {
                            if (error) return callback(error);
                            next(null, fileId);
                        });
                    }
                },
                function (fileId:cassandra.types.Uuid) {
                    parent.getFile(fileId, callback);
                }
            ]
        );
    }

    public updateFileVersion(fileId:string|cassandra.types.Uuid,
                             content:string,
                             callback:(error:ServiceError, result?:string)=>void) {
        this.fileVersion.updateVersion(fileId, content, function (error:ServiceError) {
            callback(error, 'OK');
        });
    }

    public shareFile(fileId:string|cassandra.types.Uuid,
                     isShareable:boolean,
                     isPublic:boolean,
                     viewers:(string|cassandra.types.Uuid)[],
                     editors:(string|cassandra.types.Uuid)[],
                     callback:(error:ServiceError, result?:File)=>void) {
        var parent:FileService = this;
        async.waterfall([
                function (next:(error:ServiceError, file?:File)=>void) {
                    parent.getFile(fileId, function (error:ServiceError, result:File) {
                        if (error) return callback(error);
                        if (result == null) {
                            return callback(new ServiceError(500, 'Trying to share non-existing file', "File share error"));
                        }
                        next(null, result);
                    });
                },
                function (file:File) {
                    if (viewers) {
                        viewers = viewers.filter(FilterHelper.uniqueFilter);
                    }
                    if (editors) {
                        editors = editors.filter(FilterHelper.uniqueFilter);
                    }
                    if (viewers && editors) {
                        for (var i in viewers) {
                            var curV = viewers[i].toString();
                            for (var j in editors) {
                                if (editors[j].toString() === curV) {
                                    viewers.splice(viewers.indexOf(i), 1);
                                }
                            }
                        }
                    }
                    parent.file.shareFile(fileId, isShareable, isPublic, viewers, editors, function (error:ServiceError) {
                        if (error) return callback(error);
                        parent.getFile(fileId, callback);
                    });
                }
            ]
        );
    }

    public tagQuery(userId:string|cassandra.types.Uuid,
                    fileId:string|cassandra.types.Uuid,
                    query:string,
                    callback:(error:ServiceError, result?:string[])=>void) {
        var parent:FileService = this;
        async.waterfall([
            function (next:(error:ServiceError, file?:File)=>void) {
                if (fileId == null) {
                    return next(null, null);
                }
                parent.getFile(fileId, function (error:ServiceError, result:File) {
                    if (error) return next(error, null);
                    next(null, result);
                });
            },
            function (file:File, next:(error:ServiceError, tags?:string[], file?:File)=>void) {
                parent.file.tagQuery(userId, function (error:ServiceError, result:cassandra.types.ResultSet) {
                    if (error) return callback(error);
                    var retval:string[] = [];
                    for (var i = 0; i < result.rows.length; i++) {
                        retval = retval.concat(result.rows[i]['tags']);
                    }
                    next(null, retval, file);
                })
            },
            function (tags:string[], file:File) {
                if (file != null && file.tags != null) {
                    tags = tags.filter(FilterHelper.exceptFilter(file.tags));
                }
                tags.unshift(query);
                callback(null, tags.filter(FilterHelper.uniqueFilter).filter(FilterHelper.queryFilter(query)));
            },
        ]);
    }

    public tagFile(fileId:string|cassandra.types.Uuid, tag:string, callback:(error:ServiceError, result?:File)=>void) {
        var parent:FileService = this;
        if (tag == null) {
            return callback(new ServiceError(500, 'Cannot add null tag', 'Error File tagging'));
        }
        async.waterfall([
            function (next:(error:ServiceError, result?:File)=>void) {
                parent.getFile(fileId, function (error:ServiceError, result:File) {
                    if (error) return callback(error);
                    next(null, result)
                })
            },
            function (file:File, next) {
                parent.file.tagFile(fileId, tag, function (error:ServiceError, result:cassandra.types.ResultSet) {
                    if (error) return callback(error);
                    parent.getFile(fileId, callback);
                })
            }]);
    }

    public untagFile(fileId:string|cassandra.types.Uuid, tag:string, callback:(error:ServiceError, result?:File)=>void) {
        var parent:FileService = this;
        if (tag == null) {
            return callback(new ServiceError(500, 'Cannot remove null tag', 'Error File untagging'));
        }
        async.waterfall([
            function (next:(error:ServiceError, result?:File)=>void) {
                parent.getFile(fileId, function (error:ServiceError, result:File) {
                    if (error) return callback(error);
                    next(null, result)
                })
            },
            function (file:File) {
                parent.file.untagFile(fileId, tag, function (error:ServiceError, result:cassandra.types.ResultSet) {
                    if (error) return callback(error);
                    parent.getFile(fileId, callback);
                })
            }]);
    }
}

function fileFromRow(row) {
    return new File(row['id'], row['name'], row['owner'], row['viewers'], row['editors'], row['shareable'], row['public'], row['versions'], row['tags']);
}
