import * as async from "async";
import * as cassandra from "cassandra-driver";
import {MapContainer} from "mindweb-request-classes";
import {MapVersion} from "mindweb-request-classes";
import {MapContent} from "mindweb-request-classes";
import {ServiceError} from "mindweb-request-classes";
import BaseRouter from "./BaseRouter";
import FileService from "../services/MapService";
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
                        function (next: (error: ServiceError, result?: MapContainer) => void) {
                            fileService.getMap(fileId, next);
                        },
                        function (file, next: (error: ServiceError, file?: MapContainer, fileVersionId?: cassandra.types.Uuid, fileContent?: MapContent) => void) {
                            if (!file.canView(userId)) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            const fileVersionId: cassandra.types.Uuid = file.versions[0];
                            fileService.getMapVersion(fileVersionId, function (error: ServiceError, fileVersion?: MapVersion) {
                                if (error) return appCallback(error);
                                const fileContent: MapContent = new MapContent(fileVersion.content);
                                next(null, file, fileVersionId, fileContent);
                            });
                        },
                        function (file: MapContainer, fileVersionId: cassandra.types.Uuid, fileContent: MapContent) {
                            TaskHelper.parseTasks(fileContent);
                            fileService.updateMapVersion(fileVersionId, JSON.stringify(fileContent),
                                function (error: ServiceError, result: string) {
                                    fileService.getMapVersion(fileVersionId, function (error: ServiceError, result?: MapVersion) {
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

