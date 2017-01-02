import * as async from "async";
import * as bodyParser from "body-parser";
import * as cassandra from "cassandra-driver";
import * as multer from "multer";
import File from "../classes/File";
import ServiceError from "../classes/ServiceError";
import FileVersion from "../classes/FileVersion";
import BaseRouter from "./BaseRouter";
import FileService from "../services/FileService";
import * as ConverterHelper from "../services/ConverterHelper";
import FileContent from "../classes/FileContent";

const upload = multer({storage: multer.memoryStorage()});

export default class PublicRouter extends BaseRouter {
    private fileService: FileService;

    constructor(cassandraClient: cassandra.Client) {
        super();

        console.log("Setting up DB connection for public service");
        this.fileService = new FileService(cassandraClient);

        this.router
            .get('/fileTags/', function (request, response, appCallback) {
                this.fileService.getPublicFileTags('', function (error, result) {
                    if (error) return appCallback(error);

                    response.json(result);
                    response.end();
                });
            })
            .get('/fileTags/:query', function (request, response, appCallback) {
                const query = request.params.query;
                this.fileService.getPublicFileTags(query, function (error, result) {
                    if (error) return appCallback(error);

                    response.json(result);
                    response.end();
                });
            })
            .put('/filesForTags', bodyParser.json(), function (request, response, appCallback) {
                const query: string = request.body.query;
                const tags: string[] = request.body.tags;
                this.fileService.getPublicFilesForTags(query, tags, function (error, result) {
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
                        function (next: (error: ServiceError, file?: File) => void) {
                            this.fileService.getFile(fileId, next);
                        },
                        function (file: File, next) {
                            if (!file.isPublic) {
                                if (!file.canView(userId)) {
                                    return appCallback(new ServiceError(401, 'Unauthorized', 'Unauthorized'));
                                }
                            }
                            const lastVersionId = file.versions[0];
                            this.fileService.getFileVersion(lastVersionId, function (error: ServiceError, result: FileVersion) {
                                if (error) return appCallback(error);
                                result.file = file;
                                next(null, result);
                            });
                        },
                        function (fileContent: FileVersion, next) {
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
                const file = request.file;
                console.log("Received request to transform file: " + file.originalname + " length:" + file.size);
                ConverterHelper.fromFreeplane(file.buffer, function (error, fileContent: FileContent) {
                        if (error) return appCallback(error);
                        const retval: FileVersion = new FileVersion(0, fileContent);
                        retval.file = new File('DUMMY_ID', file.originalName, null, null, null, false, false, null, null);
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

