import * as async from "async";
import * as bodyParser from "body-parser";
import * as cassandra from "cassandra-driver";
import * as multer from "multer";
import {MapContainer} from "mindweb-request-classes";
import {ServiceError} from "mindweb-request-classes";
import {MapVersion} from "mindweb-request-classes";
import BaseRouter from "./BaseRouter";
import FileService from "../services/MapService";
import * as ConverterHelper from "../services/ConverterHelper";
import {MapContent} from "mindweb-request-classes";

const upload = multer({storage: multer.memoryStorage()});

export default class PublicRouter extends BaseRouter {

    constructor(cassandraClient: cassandra.Client) {
        super();

        console.log("Setting up DB connection for public service");
        const fileService = new FileService(cassandraClient);

        this.router
            .get('/fileTags/', (request, response, appCallback) => {
                fileService.getPublicFileTags('', (error, result) => {
                    if (error) return appCallback(error);

                    response.json(result);
                    response.end();
                });
            })
            .get('/fileTags/:query', (request, response, appCallback) => {
                const query = request.params.query;
                fileService.getPublicFileTags(query, (error, result) => {
                    if (error) return appCallback(error);

                    response.json(result);
                    response.end();
                });
            })
            .put('/filesForTags', bodyParser.json(), (request, response, appCallback) => {
                const query: string = request.body.query;
                const tags: string[] = request.body.tags;
                fileService.getPublicMapsForTags(query, tags, (error, result) => {
                    if (error) return appCallback(error);

                    response.json(result);
                    response.end();
                });
            })
            .get('/mapDAO/:id', (request, response, appCallback) => {
                const fileId = request.params.id;
                const userId = request.user ? request.user.id : null;
                async.waterfall(
                    [
                        function (next: (error: ServiceError, file?: MapContainer) => void) {
                            fileService.getMap(fileId, next);
                        },
                        (file: MapContainer, next) => {
                            if (!file.isPublic) {
                                if (!file.canView(userId)) {
                                    return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                                }
                            }
                            const lastVersionId = file.versions[0];
                            fileService.getMapVersion(lastVersionId, (error: ServiceError, result: MapVersion) => {
                                if (error) return appCallback(error);
                                result.container = file;
                                next(null, result);
                            });
                        },
                        (fileVersion: MapVersion, next) => {
                            fileVersion.container['owned'] = fileVersion.container.canRemove(userId);
                            fileVersion.container['editable'] = fileVersion.container.canEdit(userId);
                            fileVersion.container['viewable'] = fileVersion.container.canView(userId);
                            response.json(fileVersion);
                            response.end();
                            next();
                        }],
                    (error) => {
                        if (error) appCallback(error);
                    })
            })
            .get('/convert/freeplane/:id', (request, response, appCallback) => {
                const fileId = request.params.id;
                async.waterfall(
                    [
                        (next) => {
                            fileService.getMap(fileId, next);
                        },
                        (fileInfo, next) => {
                            if (!fileInfo.canView(request.user.id)) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            const fileVersionId = fileInfo.versions[0];
                            fileService.getMapVersion(fileVersionId, (error, fileVersion) => {
                                if (error) return appCallback(error);
                                next(null, fileInfo, fileVersion)
                            });
                        },
                        (fileInfo, fileVersion) => {
                            ConverterHelper.toFreeplane(fileVersion.content, (error, result) => {
                                if (error) return appCallback(error);
                                response.write(result);
                                response.end();
                                appCallback(null);
                            });
                        }],
                    (error) => {
                        if (error) appCallback(error);
                    });
            })
            .post('/display', upload.single('mapDAO'), (request, response, appCallback) => {
                const file = request.mapDAO;
                console.log("Received request to transform mapDAO: " + file.originalname + " length:" + file.size);
                ConverterHelper.fromFreeplane(file.buffer, (error, fileContent: MapContent) => {
                        if (error) return appCallback(error);
                        const retval: MapVersion = new MapVersion();
                        retval.version = 0;
                        retval.content = fileContent;
                        retval.container = new MapContainer();
                        retval.container.name = file.originalname;
                        response.json(retval);
                        response.end();
                    }
                );

            });
    }
}

