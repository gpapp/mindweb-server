import * as app from "../app";
import {AbstractRequest} from "./AbstractRequest";
import TextResponse from "../responses/TextResponse";
import KafkaService from "../services/KafkaService";
import AbstractResponse from "../responses/AbstractResponse";
import ErrorResponse from "../responses/ErrorResponse";
import FileService from "../services/FileService";
import ServiceError from "../classes/ServiceError";
import File from "../classes/File";
import EditAction from "../classes/EditAction";


export default class EditRequest extends AbstractRequest {
    static initialized: boolean;
    static fileService: FileService;
    fileId: string;
    action: EditAction;

    constructor(fileId: string, action: EditAction) {
        super("EditRequest");
        this.fileId = fileId;
        this.action = action;
    }

    execute(userId: string, kafkaService: KafkaService, next: (response: AbstractResponse) => void) {
        if (!EditRequest.initialized) {
            EditRequest.fileService = new FileService(app.cassandraClient);
            EditRequest.initialized = true;
        }
        const fileId = this.fileId;
        const action = this.action;
        const sessionId: string = this.sessionId;
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