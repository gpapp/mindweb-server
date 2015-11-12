/// <reference path="../typings/tsd.d.ts" />
import * as async from 'async';
import * as bodyParser from 'body-parser';
import * as cassandra from 'cassandra-driver';

import File from '../classes/File';
import ServiceError from '../classes/ServiceError';
import EditAction from "../classes/EditAction";

import StorageSchema from '../db/storage_schema';

import BaseRouter from './BaseRouter';
import MapNode from "../classes/MapNode";
import * as TaskHelper from "../services/TaskHelper";
import FileService from "../services/FileService";
import Task from "../classes/Task";

export default class PublicRouter extends BaseRouter {
    private fileService;

    constructor(cassandraOptions:cassandra.client.Options, next:Function) {
        super();

        console.log("Setting up DB connection for task service");
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
            .get('/parseTasks/:id', function (request, response, appCallback) {
                var fileId = request.params.id;
                async.waterfall(
                    [
                        function (next) {
                            this.fileService.getFile(fileId, next);
                        },
                        function (fileInfo, next) {
                            if (!fileInfo.canView(request.user.id)) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            var fileVersionId = fileInfo.versions[0];
                            this.fileService.getFileVersion(fileVersionId, function (error, fileVersion) {
                                if (error) return appCallback(error);
                                next(null, fileInfo, fileVersion)
                            });
                        },
                        function (fileInfo, fileVersion, next) {
                            TaskHelper.parseTasks(fileVersion.content, function (error, result) {
                                if (error) return appCallback(error);
                                response.write(result);
                                response.end();
                            });
                        }],
                    function (error) {
                        if (error) appCallback(error);
                    });
            })
        ;
    }
}

