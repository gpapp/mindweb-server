/// <reference path="../typings/tsd.d.ts" />
import * as async from 'async';

import File from '../classes/File';
import ServiceError from "../classes/ServiceError";

import FileDAO from '../dao/File';
import FileVersionDAO from '../dao/FileVersion';
import * as cassandra from 'cassandra-driver';

var Uuid = require('cassandra-driver').types.Uuid;

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
                             callback:Function) {
        this.file.getPublicFileTags(function (error, result) {
            if (error) return callback(error);
            var tags:string[] = [];
            for (var i = 0; i < result.rows.length; i++) {
                tags = tags.concat(result.rows[i]['tags']);
            }
            tags = tags.filter(queryFilter(query));
            var tagCloud = {};
            for (var i = 0; i < tags.length; i++) {
                tagCloud[tags[i]] = (tagCloud[tags[i]] == undefined ? 1 : tagCloud[tags[i]] + 1);
            }
            callback(null, tagCloud);
        })
    }

    public getPublicFilesForTags(query:string, tags:string[], callback:Function) {
        var parent:FileService = this;
        async.waterfall ([
            function (waterNext:Function) {
                if (tags.length == 0) {
                    parent.file.getPublicFiles(function (error, result) {
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
                    async.each(tags, function (tag:string, next:Function) {
                            parent.file.getPublicFilesForTag(tag, function (error, result) {
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
                        function (error) {
                            if (error) return callback(error);
                            waterNext(null, retval);
                        }
                    )
                }
            },
            function (retval:File[], next) {
                retval =
                    retval
                        .filter(uniqueFilterFile)
                        .filter(queryFilterFile(query))
                        .filter(function (v:File) {
                            if (v.tags==null){
                                return tags.length==0;
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

    public getFiles(userId:string|cassandra.types.Uuid, callback:Function) {
        this.file.getFiles(userId, function (error, result) {
            if (error) {
                return callback(error, null);
            }
            var retval = new Array(result.rows.length);
            for (var i = 0; i < result.rows.length; i++) {
                var row = result.rows[i];
                retval[i] = fileFromRow(row);
            }
            callback(null, retval);
        });
    }

    public getSharedFiles(userId:string|cassandra.types.Uuid, callback:Function) {
        var parent:FileService = this;
        var retval = [];
        async.parallel([
            function (next:Function) {
                parent.file.getSharedFilesForEdit(userId, function (error, result) {
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
                parent.file.getSharedFilesForView(userId, function (error, result) {
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

    public getFile(fileId:string|cassandra.types.Uuid, callback:Function) {
        this.file.getFile(fileId, function (error, result) {
            if (error) {
                return callback(error, null);
            }
            var row = result.first();
            if (row == null) {
                return callback('No such file version by that id', null);
            }
            callback(null, fileFromRow(row));
        });
    }

    public deleteFile(fileId:string|cassandra.types.Uuid, callback:Function) {
        var parent = this;

        this.file.getFile(fileId, function (error, result) {
            if (error)
                return callback(error);
            if (result.rows.length > 0) {
                async.each(result.rows[0].versions, function (fileVersionId:string|cassandra.types.Uuid, next) {
                    parent.fileVersion.deleteById(fileVersionId, function () {
                        next();
                    });
                }, function (error) {
                    if (error) {
                        return callback(error);
                    }
                    parent.file.deleteById(fileId, function (error) {
                        if (error) {
                            return callback(error);
                        }
                        callback(null, 'OK');
                    });
                });
            }
            else {
                callback('FileService not found', null);
            }
        });
    }

    public renameFile(fileId:string|cassandra.types.Uuid, newFileName:string, callback:Function) {
        var parent = this;
        // TODO: Check filename availibility
        this.file.renameById(fileId, newFileName, function (error) {
            if (error) {
                return callback(error);
            }
            parent.getFile(fileId, callback);
        });
    }

    public getFileVersion(fileVersionId:string|cassandra.types.Uuid, callback:Function) {
        this.fileVersion.getContent(fileVersionId, function (error, result) {
            if (error) {
                return callback(error, null);
            }
            var row = result.first();
            if (row != null) {
                callback(null, {version: row.version, content: JSON.parse(row.content)});
            }
            else {
                callback('No such file version by that id');
            }
        });
    }

    public createNewVersion(userId:string|cassandra.types.Uuid,
                            fileName:string,
                            isPublic:boolean,
                            viewers:string[]|cassandra.types.Uuid[],
                            editors:string[]|cassandra.types.Uuid[],
                            tags:string[],
                            content:string,
                            callback:Function) {
        var parent = this;
        async.waterfall([
                function (next) {
                    parent.file.getFileByUserAndName(userId, fileName, function (error, result) {
                        if (error) return callback(error);
                        var fileId;
                        var versions;
                        if (result.rows.length > 0) {
                            fileId = result.rows[0].id;
                            versions = result.rows[0].versions;
                        }
                        else {
                            fileId = Uuid.random();
                            versions = [];
                        }
                        next(null, fileId, versions);
                    });
                },
                function (fileId, versions, next) {
                    var newFileVersionId = Uuid.random();
                    if (versions.length > 0) {
                        var oldFileVersionId = versions[0];
                        parent.fileVersion.getContent(oldFileVersionId, function (error, result) {
                            if (error) return callback(error);
                            var row = result.first();
                            if (content === row.content) {
                                next(null, fileId, versions);
                            }
                            else {
                                parent.fileVersion.createNewVersion(newFileVersionId, versions.length + 1, content, function (error) {
                                    if (error) return callback(error);
                                    versions.unshift(newFileVersionId);
                                    next(null, fileId, versions);
                                });
                            }
                        });
                    }
                    else {
                        parent.fileVersion.createNewVersion(newFileVersionId, versions.length + 1, content, function (error) {
                            if (error) return callback(error);
                            versions.unshift(newFileVersionId);
                            next(null, fileId, versions);
                        });
                    }
                },
                function (fileId:string|cassandra.types.Uuid, versions:string[]|cassandra.types.Uuid[], next:Function) {
                    var isUpdate = versions.length > 1;
                    if (isUpdate) {
                        parent.file.updateFile(fileId, fileName, isPublic, viewers, editors, versions, tags, function (error) {
                            if (error) return callback(error);
                            next(null, fileId);
                        });
                    }
                    else {
                        parent.file.createFile(fileId, fileName, userId, isPublic, viewers, editors, versions, tags, function (error) {
                            if (error) return callback(error);
                            next(null, fileId);
                        });
                    }
                },
                function (fileId:string|cassandra.types.Uuid) {
                    parent.getFile(fileId, callback);
                }
            ]
        );
    }

    public updateFileVersion(fileId:string|cassandra.types.Uuid,
                             content:string,
                             callback:Function) {
        this.fileVersion.updateVersion(fileId, content, function (error) {
            callback(error, 'OK');
        });
    }

    public shareFile(fileId:string|cassandra.types.Uuid,
                     isPublic:boolean,
                     viewers:(string|cassandra.types.Uuid)[],
                     editors:(string|cassandra.types.Uuid)[],
                     callback:Function) {
        var parent = this;
        async.waterfall([
                function (next) {
                    parent.getFile(fileId, function (error, result:File) {
                        if (error) return callback(error);
                        if (result == null) {
                            return callback(new ServiceError(500, 'Trying to share non-existing file', "File share error"));
                        }
                        next(null, result);
                    });
                },
                function (file:File, next) {
                    if (viewers) {
                        viewers = viewers.filter(uniqueFilter);
                    }
                    if (editors) {
                        editors = editors.filter(uniqueFilter);
                    }
                    if (viewers && editors) {
                        for (var i in viewers) {
                            var curV = viewers[i].toString();
                            for (var j in editors) {
                                if (editors[j].toString() === curV) {
                                    viewers.splice(i, 1);
                                }
                            }
                        }
                    }
                    parent.file.shareFile(fileId, isPublic, viewers, editors, function (error) {
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
                    callback:Function) {
        var parent = this;
        async.waterfall([
            function (next) {
                if (fileId == null) {
                    return next(null, null);
                }
                parent.getFile(fileId, function (error, result:File) {
                    if (error) return next(null, null);
                    next(null, result);
                });
            },
            function (file:File, next) {
                parent.file.tagQuery(userId, function (error, result) {
                    if (error) return callback(error);
                    var retval:string[] = [];
                    for (var i = 0; i < result.rows.length; i++) {
                        retval = retval.concat(result.rows[i]['tags']);
                    }
                    next(null, retval, file);
                })
            },
            function (tags:string[], file:File, next) {
                if (file != null && file.tags != null) {
                    tags = tags.filter(exceptFilter(file.tags));
                }
                callback(null, tags.filter(uniqueFilter).filter(queryFilter(query)));
            },
        ]);
    }

    public tagFile(fileId:string|cassandra.types.Uuid, tag:string, callback:Function) {
        var parent = this;
        if (tag == null) {
            return callback(new ServiceError(500, 'Cannot add null tag', 'Error File tagging'));
        }
        async.waterfall([
            function (next) {
                parent.getFile(fileId, function (error, result:File) {
                    if (error) return callback(error);
                    next(null, result)
                })
            },
            function (file:File, next) {
                parent.file.tagFile(fileId, tag, function (error, result) {
                    if (error) return callback(error);
                    parent.getFile(fileId, callback);
                })
            }]);
    }

    public untagFile(fileId:string|cassandra.types.Uuid, tag:string, callback:Function) {
        var parent = this;
        if (tag == null) {
            return callback(new ServiceError(500, 'Cannot remove null tag', 'Error File untagging'));
        }
        async.waterfall([
            function (next) {
                parent.getFile(fileId, function (error, result:File) {
                    if (error) return callback(error);
                    next(null, result)
                })
            },
            function (file:File, next) {
                parent.file.untagFile(fileId, tag, function (error, result) {
                    if (error) return callback(error);
                    parent.getFile(fileId, callback);
                })
            }]);
    }
}

function fileFromRow(row) {
    return new File(row['id'], row['name'], row['owner'], row['viewers'], row['editors'], row['public'], row['versions'], row['tags']);
}

function uniqueFilter(value, index, array) {
    return array.indexOf(value) === index;
}

function exceptFilter(toFilter:string[]) {
    return function (value:string, index:number, array:any[]) {
        return toFilter.indexOf(value) == -1;
    }
}

function queryFilter(query:string) {
    var rex:RegExp;
    rex = new RegExp('.*' + query.toLowerCase() + '.*');
    return function (value:string, index:number, array:any[]) {
        if (value == null) return false;
        return rex.test(value.toLowerCase());
    }
}

function uniqueFilterFile(value:File, index:number, array:File[]) {
    for (var i = 0; i < index; i++) {
        if (array[i].id.toString() === value.id.toString()) {
            return false;
        }
    }
    return true;
}

function queryFilterFile(query:string) {
    var rex:RegExp;
    rex = new RegExp('.*' + query.toLowerCase() + '.*');
    return function (value:File, index:number, array:File[]) {
        if (value == null) return false;
        return rex.test(value.name.toLowerCase());
    }
}
