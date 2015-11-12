/// <reference path="../typings/tsd.d.ts" />
import * as async from 'async';
import * as bodyParser from 'body-parser';
import * as cassandra from 'cassandra-driver';

import File from '../classes/File';
import ServiceError from '../classes/ServiceError';
import EditAction from "../classes/EditAction";
import FileVersion from "../classes/FileVersion";

import StorageSchema from '../db/storage_schema';

import BaseRouter from './BaseRouter';
import FileService from '../services/FileService';

var fileService:FileService;
export default class PublicRouter extends BaseRouter {

    constructor(cassandraOptions:cassandra.client.Options, next:Function) {
        super();

        console.log("Setting up DB connection for public service");
        var cassandraClient = new cassandra.Client(cassandraOptions);
        cassandraClient.connect(function (error) {
            if (error) {
                console.error(error);
                throw new Error('Cannot connect to database');
            }
            fileService = new FileService(cassandraClient);
            next();
        });

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
                async.waterfall(
                    [
                        function (next) {
                            fileService.getFile(request.params.id, next);
                        },
                        function (fileInfo:File, next) {
                            if (!fileInfo.isPublic){
                                if (!fileInfo.canView(request.user.id)) {
                                    return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                                }
                            }
                            var lastVersionId = fileInfo.versions[0];
                            fileService.getFileVersion(lastVersionId, function (error:ServiceError, result:FileVersion) {
                                if (error) return appCallback(error);
                                result.file = fileInfo;
                                next(null, result);
                            });
                        },
                        function (fileContent, next) {
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

