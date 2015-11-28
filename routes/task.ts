/// <reference path="../typings/tsd.d.ts" />
import * as async from 'async';
import * as bodyParser from 'body-parser';
import * as cassandra from 'cassandra-driver';

import File from '../classes/File';
import FileVersion from "../classes/FileVersion";
import FileContent from "../classes/FileContent";
import Task from "../classes/Task";
import ServiceError from '../classes/ServiceError';

import BaseRouter from './BaseRouter';
import FileService from "../services/FileService";
import * as ConverterHelper from "../services/ConverterHelper";
import * as TaskHelper from "../services/TaskHelper";

var fileService:FileService;
export default class TaskRouter extends BaseRouter {

    constructor(cassandraClient:cassandra.Client) {
        super();

        console.log("Setting up DB connection for task service");
        fileService = new FileService(cassandraClient);

        this.router
            .get('/parse/:id', function (request, response, appCallback) {
                var fileId = request.params.id;
                var userId = request.user ? request.user.id : null;
                async.waterfall(
                    [
                        function (next:(error:ServiceError, result?:File)=>void) {
                            fileService.getFile(fileId, next);
                        },
                        function (file, next:(error:ServiceError, file?:File, fileVersionId?:cassandra.types.Uuid, fileContent?:FileContent)=>void) {
                            if (!file.canView(userId)) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            var fileVersionId:cassandra.types.Uuid = file.versions[0];
                            fileService.getFileVersion(fileVersionId, function (error:ServiceError, fileVersion?:FileVersion) {
                                if (error) return appCallback(error);
                                var fileContent:FileContent = new FileContent(fileVersion.content);
                                next(null, file, fileVersionId, fileContent);
                            });
                        },
                        function (file:File, fileVersionId:cassandra.types.Uuid, fileContent:FileContent, next) {
                            TaskHelper.parseTasks(fileContent);
                            fileService.updateFileVersion(fileVersionId, JSON.stringify(fileContent),
                                function (error:ServiceError, result:string) {
                                    fileService.getFileVersion(fileVersionId, function (error:ServiceError, result?:FileVersion) {
                                        if (error) return appCallback(error);
                                        result.file = file;
                                        result.file['owned'] = file.canRemove(userId);
                                        result.file['editable'] = file.canEdit(userId);
                                        result.file['viewable'] = file.canView(userId);
                                        response.json(result);
                                        response.end();
                                    });
                                });
                        }],
                    function (error) {
                        if (error) appCallback(error);
                    });
            });
    }
}

