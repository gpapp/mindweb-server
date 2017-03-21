import * as app from "../app";
import {EditRequest, AbstractResponse, EditAction, MapContainer, ServiceError} from "mindweb-request-classes";
import KafkaService from "../services/KafkaService";
import FileService from "../services/MapService";
import * as cassandra from "cassandra-driver";
import ErrorResponse from "mindweb-request-classes/response/ErrorResponse";
import TextResponse from "mindweb-request-classes/response/TextResponse";

export default class EditRequestImpl extends EditRequest {
    static fileService: FileService;
    static initialized: boolean;

    constructor(fileId: string|cassandra.types.Uuid, action: EditAction) {
        super(fileId.toString(), action);
    }

    internalExecute(userId: string, kafkaService: KafkaService, next: (response: AbstractResponse) => void) {
        if (!EditRequestImpl.initialized) {
            EditRequestImpl.fileService = new FileService(app.cassandraClient);
            EditRequestImpl.initialized = true;
        }
        const fileId = (this as EditRequest).fileId;
        const action = (this as EditRequest).action;
        const sessionId: string = (this as EditRequest).sessionId;
        EditRequestImpl.fileService.getMap(fileId, function (error: ServiceError, file: MapContainer) {
            if (error) {
                next(new ErrorResponse(error));
                return;
            }
            if (!file.canEdit(userId)) {
                next(new ErrorResponse({name: "Permission denied", message: "User cannot read mapDAO"}));
                return;
            }
            kafkaService.sendUpdateToFile(sessionId, fileId, action, function (error: Error) {
                let response;
                if (error) {
                    response = new ErrorResponse(error);
                } else {
                    response = new TextResponse("Edit accepted");
                    response.result = "ok";
                }
                next(response);
            });
        });
    }

}