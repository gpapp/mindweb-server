/// <reference path="../typings/tsd.d.ts" />
import * as async from 'async';
import * as bodyParser from 'body-parser';
import * as cassandra from 'cassandra-driver';

import File from '../classes/File';
import FileVersion from "../classes/FileVersion";
import FileContent from "../classes/FileContent";
import Task from "../classes/Task";
import ServiceError from '../classes/ServiceError';

import StorageSchema from '../db/storage_schema';

import BaseRouter from './BaseRouter';
import FileService from "../services/FileService";
import * as ConverterHelper from "../services/ConverterHelper";
import * as TaskHelper from "../services/TaskHelper";

export default class TaskRouter extends BaseRouter {
    private fileService:FileService;

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
            .get('/parse/:id', function (request, response, appCallback) {
                var fileId = request.params.id;
                var parent:TaskRouter = this;
                async.waterfall(
                    [
                        function (next:(error:ServiceError, result?:File)=>void) {
                            parent.fileService.getFile(fileId, next);
                        },
                        function (file, next:(error:ServiceError, file?:File, fileVersionId?:cassandra.types.Uuid, fileContent?:FileContent)=>void) {
                            if (!file.canView(request.user.id)) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            var fileVersionId:cassandra.types.Uuid = file.versions[0];
                            parent.fileService.getFileVersion(fileVersionId, function (error:ServiceError, fileVersion?:FileVersion) {
                                if (error) return appCallback(error);
                                var fileContent:FileContent = new FileContent(fileVersion.content);
                                next(null, file, fileVersionId, fileContent);
                            });
                        },
                        function (file:File, fileVersionId:cassandra.types.Uuid, fileContent:FileContent, next) {
                            TaskHelper.parseTasks(fileContent);
                            parent.fileService.updateFileVersion(fileVersionId, JSON.stringify(fileContent),
                                function (error:ServiceError, result:string) {
                                    parent.fileService.getFileVersion(fileVersionId, function (error:ServiceError, result?:FileVersion) {
                                        if (error) return appCallback(error);
                                        result.file = file;
                                        response.json(result);
                                        response.end();
                                    });
                                });
                        }],
                    function (error) {
                        if (error) appCallback(error);
                    });
            })
        ;
    }
}

