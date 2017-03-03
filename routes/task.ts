import * as async from "async";
import * as cassandra from "cassandra-driver";
import File from "mindweb-request-classes/dist/classes/File";
import FileVersion from "mindweb-request-classes/dist/classes/FileVersion";
import FileContent from "mindweb-request-classes/dist/classes/FileContent";
import ServiceError from "mindweb-request-classes/dist/classes/ServiceError";
import BaseRouter from "./BaseRouter";
import FileService from "../services/FileService";
import * as TaskHelper from "../services/TaskHelper";

export default class TaskRouter extends BaseRouter {

    constructor(cassandraClient: cassandra.Client) {
        super();

        console.log("Setting up DB connection for task service");
        const fileService: FileService = new FileService(cassandraClient);

        this.router
            .get('/parse/:id', function (request, response, appCallback) {
                const fileId = request.params.id;
                const userId = request.user ? request.user.id : null;
                async.waterfall(
                    [
                        function (next: (error: ServiceError, result?: File) => void) {
                            fileService.getFile(fileId, next);
                        },
                        function (file, next: (error: ServiceError, file?: File, fileVersionId?: cassandra.types.Uuid, fileContent?: FileContent) => void) {
                            if (!file.canView(userId)) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            const fileVersionId: cassandra.types.Uuid = file.versions[0];
                            fileService.getFileVersion(fileVersionId, function (error: ServiceError, fileVersion?: FileVersion) {
                                if (error) return appCallback(error);
                                const fileContent: FileContent = new FileContent(fileVersion.content);
                                next(null, file, fileVersionId, fileContent);
                            });
                        },
                        function (file: File, fileVersionId: cassandra.types.Uuid, fileContent: FileContent) {
                            TaskHelper.parseTasks(fileContent);
                            fileService.updateFileVersion(fileVersionId, JSON.stringify(fileContent),
                                function (error: ServiceError, result: string) {
                                    fileService.getFileVersion(fileVersionId, function (error: ServiceError, result?: FileVersion) {
                                        if (error) return appCallback(error);
                                        result.file = file;
                                        result.file['owned'] = file.canRemove(userId);
                                        result.file['editable'] = file.canEdit(userId);
                                        result.file['viewable'] = file.canView(userId);
                                        response.json(result);
                                        response.end();
                                        appCallback();
                                    });
                                });
                        }],
                    function (error) {
                        if (error) appCallback(error);
                    });
            });
    }
}

