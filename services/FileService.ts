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
                        var fileId;
                        var versions;
                        if (error)
                            return next(error);
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
                            var row = result.first();
                            if (content === row.content) {
                                next(null, fileId, versions);
                            }
                            else {
                                parent.fileVersion.createNewVersion(newFileVersionId, versions.length + 1, content, function (error) {
                                    if (error) {
                                        return next(error);
                                    }
                                    versions.unshift(newFileVersionId);
                                    next(null, fileId, versions);
                                });
                            }
                        });
                    }
                    else {
                        parent.fileVersion.createNewVersion(newFileVersionId, versions.length + 1, content, function (error) {
                            if (error) return next(error);
                            versions.unshift(newFileVersionId);
                            next(null, fileId, versions);
                        });
                    }
                },
                function (fileId:string|cassandra.types.Uuid, versions:string[]|cassandra.types.Uuid[], next:Function) {
                    var isUpdate = versions.length > 1;
                    if (isUpdate) {
                        parent.file.updateFile(fileId, fileName, isPublic, viewers, editors, versions, tags, function (error) {
                            next(error, fileId);
                        });
                    }
                    else {
                        parent.file.createFile(fileId, fileName, userId, isPublic, viewers, editors, versions, tags, function (error) {
                            next(error, fileId);
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

    public tagFile(fileId:string|cassandra.types.Uuid, tag:string, callback:Function) {
        var parent = this;
        async.waterfall([
            function (next) {
                parent.getFile(fileId, function (error, result:File) {
                    if (error) return callback(error);
                    next(null, result)
                })
            },
            function (file:File, next) {
                if (tag == null) {
                    return callback(new ServiceError(500, 'Cannot add null tag', 'Error File tagging'));
                }
                var tags;
                if (file.tags == null) {
                    tags = [tag];
                } else {
                    tags = [tag].concat(file.tags).filter(function (value, index, array) {
                        return array.indexOf(value) == index;
                    });
                }
                parent.file.updateFile(fileId, file.name, file.isPublic, file.viewers, file.editors, file.versions, tags, function (error, result) {
                    if (error) return callback(error);
                    parent.getFile(fileId, callback);
                })
            }
        ]);
    }

    public untagFile(fileId:string|cassandra.types.Uuid, tag:string, callback:Function) {
        var parent = this;
        async.waterfall([
            function (next) {
                parent.getFile(fileId, function (error, result:File) {
                    if (error) return callback(error);
                    next(null, result)
                })
            },
            function (file:File, next) {
                if (tag == null) {
                    return callback(new ServiceError(500, 'Cannot remove null tag', 'Error File untagging'));
                }
                var tags = file.tags.filter(function (value, index, array) {
                    return (array.indexOf(value) == index && value != tag);
                });
                parent.file.updateFile(fileId, file.name, file.isPublic, file.viewers, file.editors, file.versions, tags, function (error, result) {
                    if (error) return callback(error);
                    parent.getFile(fileId, callback);
                })
            }
        ]);
    }
}

function fileFromRow(row) {
    return new File(row['id'], row['name'], row['owner'], row['viewers'], row['editors'], row['public'], row['versions'], row['tags']);
}
function uniqueFilter(value, index, array) {
    return array.indexOf(value) === index;
}