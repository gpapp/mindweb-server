/// <reference path="../typings/tsd.d.ts" />
import * as async from 'async';
import * as bodyParser from 'body-parser';
import * as cassandra from 'cassandra-driver';

import File from '../classes/File';
import ServiceError from '../classes/ServiceError';
import EditAction from "../classes/EditAction";
import FileVersion from "../classes/FileVersion";

import BaseRouter from './BaseRouter';
import StorageSchema from '../db/storage_schema';
import FileService from '../services/FileService';

export default class PublicRouter extends BaseRouter {
    private fileService:FileService;

    constructor(cassandraOptions:cassandra.client.Options, next:Function) {
        super();

        console.log("Setting up DB connection for public service");
        var cassandraClient = new cassandra.Client(cassandraOptions);
        cassandraClient.connect(function (error) {
            if (error) {
                console.error(error);
                throw new Error('Cannot connect to database');
            }
            this.fileService = new FileService(cassandraClient);
            next();
        });

        this.router
            .get('/fileTags/', function (request, response, appCallback) {
                this.fileService.getPublicFileTags('', function (error, result) {
                    if (error) return appCallback(error);

                    response.json(result);
                    response.end();
                });
            })
            .get('/fileTags/:query', function (request, response, appCallback) {
                var query = request.params.query;
                this.fileService.getPublicFileTags(query, function (error, result) {
                    if (error) return appCallback(error);

                    response.json(result);
                    response.end();
                });
            })
            .put('/filesForTags', bodyParser.json(), function (request, response, appCallback) {
                var query:string = request.body.query;
                var tags:string[] = request.body.tags;
                this.fileService.getPublicFilesForTags(query, tags, function (error, result) {
                    if (error) return appCallback(error);

                    response.json(result);
                    response.end();
                });
            })
            .get('/file/:id', function (request, response, appCallback) {
                var fileId = request.params.id;
                var parent:PublicRouter = this;
                var userId = request.user?request.user.id:null;
                async.waterfall(
                    [
                        function (next:(error:ServiceError, file?:File)=>void) {
                            parent.fileService.getFile(fileId, next);
                        },
                        function (file:File, next) {
                            if (!file.isPublic) {
                                if (!file.canView(userId)) {
                                    return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                                }
                            }
                            var lastVersionId = file.versions[0];
                            parent.fileService.getFileVersion(lastVersionId, function (error:ServiceError, result:FileVersion) {
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
            });
    }
}

