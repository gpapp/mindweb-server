import * as async from "async";
import * as bodyParser from "body-parser";
import * as cassandra from "cassandra-driver";
import * as multer from "multer";
import MyFile from "mindweb-request-classes/dist/classes/File";
import ServiceError from "mindweb-request-classes/dist/classes/ServiceError";
import FileVersion from "mindweb-request-classes/dist/classes/FileVersion";
import BaseRouter from "./BaseRouter";
import FileService from "../services/FileService";
import * as ConverterHelper from "../services/ConverterHelper";
import FileContent from "mindweb-request-classes/dist/classes/FileContent";

const upload = multer({storage: multer.memoryStorage()});

export default class PublicRouter extends BaseRouter {

    constructor(cassandraClient: cassandra.Client) {
        super();

        console.log("Setting up DB connection for public service");
        const fileService = new FileService(cassandraClient);

        this.router
            .get('/fileTags/', function (request, response, appCallback) {
                fileService.getPublicFileTags('', function (error, result) {
                    if (error) return appCallback(error);

                    response.json(result);
                    response.end();
                });
            })
            .get('/fileTags/:query', function (request, response, appCallback) {
                const query = request.params.query;
                fileService.getPublicFileTags(query, function (error, result) {
                    if (error) return appCallback(error);

                    response.json(result);
                    response.end();
                });
            })
            .put('/filesForTags', bodyParser.json(), function (request, response, appCallback) {
                const query: string = request.body.query;
                const tags: string[] = request.body.tags;
                fileService.getPublicFilesForTags(query, tags, function (error, result) {
                    if (error) return appCallback(error);

                    response.json(result);
                    response.end();
                });
            })
            .get('/file/:id', function (request, response, appCallback) {
                const fileId = request.params.id;
                const userId = request.user ? request.user.id : null;
                async.waterfall(
                    [
                        function (next: (error: ServiceError, file?: MyFile) => void) {
                            fileService.getFile(fileId, next);
                        },
                        function (file: MyFile, next) {
                            if (!file.isPublic) {
                                if (!file.canView(userId)) {
                                    return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                                }
                            }
                            const lastVersionId = file.versions[0];
                            fileService.getFileVersion(lastVersionId, function (error: ServiceError, result: FileVersion) {
                                if (error) return appCallback(error);
                                result.file = file;
                                next(null, result);
                            });
                        },
                        function (fileVersion: FileVersion, next) {
                            fileVersion.file['owned'] = fileVersion.file.canRemove(userId);
                            fileVersion.file['editable'] = fileVersion.file.canEdit(userId);
                            fileVersion.file['viewable'] = fileVersion.file.canView(userId);
                            response.json(fileVersion);
                            response.end();
                            next();
                        }],
                    function (error) {
                        if (error) appCallback(error);
                    })
            })
            .get('/convert/freeplane/:id',  function (request, response, appCallback) {
                const fileId = request.params.id;
                async.waterfall(
                    [
                        function (next) {
                            fileService.getFile(fileId, next);
                        },
                        function (fileInfo, next) {
                            if (!fileInfo.canView(request.user.id)) {
                                return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                            }
                            const fileVersionId = fileInfo.versions[0];
                            fileService.getFileVersion(fileVersionId, function (error, fileVersion) {
                                if (error) return appCallback(error);
                                next(null, fileInfo, fileVersion)
                            });
                        },
                        function (fileInfo, fileVersion) {
                            ConverterHelper.toFreeplane(fileVersion.content, function (error, result) {
                                if (error) return appCallback(error);
                                response.write(result);
                                response.end();
                                appCallback(null);
                            });
                        }],
                    function (error) {
                        if (error) appCallback(error);
                    });
            })
            .post('/display', upload.single('file'), function (request, response, appCallback) {
                const file = request.file;
                console.log("Received request to transform file: " + file.originalname + " length:" + file.size);
                ConverterHelper.fromFreeplane(file.buffer, function (error, fileContent: FileContent) {
                        if (error) return appCallback(error);
                        const retval: FileVersion = new FileVersion(0, fileContent);
                        retval.file = new MyFile('DUMMY_ID', file.originalName, null, null, null, false, false, null, null);
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

