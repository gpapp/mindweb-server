import * as app from "../app";
import EditRequest from 'mindweb-request-classes/dist/request/EditRequest';
import AbstractResponse from "mindweb-request-classes/dist/response/AbstractResponse";
import TextResponse from "mindweb-request-classes/dist/response/TextResponse";
import ErrorResponse from "mindweb-request-classes/dist/response/ErrorResponse";
import KafkaService from "../services/KafkaService";
import FileService from "../services/FileService";
import EditAction from "mindweb-request-classes/dist/classes/EditAction";
import ServiceError from "mindweb-request-classes/dist/classes/ServiceError";
import File from "mindweb-request-classes/dist/classes/File";
import * as cassandra from "cassandra-driver";

export default class EditRequestImpl extends EditRequest {
    static fileService: FileService;
    static initialized: boolean;

    constructor(fileId: string|cassandra.types.Uuid, action: EditAction) {
        super(fileId.toString(), action);
    }

    execute(userId: string, kafkaService: KafkaService, next: (response: AbstractResponse) => void) {
        if (!EditRequestImpl.initialized) {
            EditRequestImpl.fileService = new FileService(app.cassandraClient);
            EditRequestImpl.initialized = true;
        }
        const fileId = this as EditRequest.fileId;
        const action = this as EditRequest.action;
        const sessionId: string = this as EditRequest.sessionId;
        EditRequest.fileService.getFile(fileId, function (error: ServiceError, file: File) {
            if (error) {
                next(new ErrorResponse(error));
                return;
            }
            if (!file.canEdit(userId)) {
                next(new ErrorResponse({name: "Permission denied", message: "User cannot read file"}));
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