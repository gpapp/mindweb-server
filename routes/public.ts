/// <reference path="../typings/tsd.d.ts" />
import * as async from 'async';
import * as bodyParser from 'body-parser';
import * as cassandra from 'cassandra-driver';

import File from '../classes/File';
import ServiceError from '../classes/ServiceError';
import EditAction from "../classes/EditAction";
import FileVersion from "../classes/FileVersion";

import BaseRouter from './BaseRouter';
import FileService from '../services/FileService';

import * as ConverterHelper from '../services/ConverterHelper'
import FileContent from "../classes/FileContent";

var multer = require('multer');
var fileService:FileService;
const upload = multer({inMemory: true});

export default class PublicRouter extends BaseRouter {

    constructor(cassandraClient:cassandra.Client) {
        super();

        console.log("Setting up DB connection for public service");
        fileService = new FileService(cassandraClient);

        this.router
            .get('/fileTags/', function (request, response, appCallback) {
                fileService.getPublicFileTags('', function (error, result) {
                    if (error) return appCallback(error);

                    response.json(result);
                    response.end();
                });
            })
            .get('/fileTags/:query', function (request, response, appCallback) {
                var query = request.params.query;
                fileService.getPublicFileTags(query, function (error, result) {
                    if (error) return appCallback(error);

                    response.json(result);
                    response.end();
                });
            })
            .put('/filesForTags', bodyParser.json(), function (request, response, appCallback) {
                var query:string = request.body.query;
                var tags:string[] = request.body.tags;
                fileService.getPublicFilesForTags(query, tags, function (error, result) {
                    if (error) return appCallback(error);

                    response.json(result);
                    response.end();
                });
            })
            .get('/file/:id', function (request, response, appCallback) {
                var fileId = request.params.id;
                var userId = request.user ? request.user.id : null;
                async.waterfall(
                    [
                        function (next:(error:ServiceError, file?:File)=>void) {
                            fileService.getFile(fileId, next);
                        },
                        function (file:File, next) {
                            if (!file.isPublic) {
                                if (!file.canView(userId)) {
                                    return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                                }
                            }
                            var lastVersionId = file.versions[0];
                            fileService.getFileVersion(lastVersionId, function (error:ServiceError, result:FileVersion) {
                                if (error) return appCallback(error);
                                result.file = file;
                                next(null, result);
                            });
                        },
                        function (fileContent:FileVersion, next) {
                            fileContent.file['owned'] = fileContent.file.canRemove(userId);
                            fileContent.file['editable'] = fileContent.file.canEdit(userId);
                            fileContent.file['viewable'] = fileContent.file.canView(userId);
                            response.json(fileContent);
                            response.end();
                            next();
                        }],
                    function (error) {
                        if (error) appCallback(error);
                    })
            })
            .post('/display', upload.single('file'), function (request, response, appCallback) {
                var file = request.file;
                console.log("Received request to transform file: " + file.originalname + " length:" + file.size);
                ConverterHelper.fromFreeplane(file.buffer, function (error, fileContent:FileContent) {
                        if (error) return appCallback(error);
                        var retval:FileVersion = new FileVersion(0, fileContent);
                        var dummyFile:File = new File('DUMMY_ID', file.originalName, null, null, null, false, false, null, null);
                        retval.file = dummyFile;
                        retval.file['owned'] = false;
                        retval.file['editable'] = false;
                        retval.file['viewable'] = false;
                        response.json(retval);
                        response.end();
                    }
                );

            });
    }
}

