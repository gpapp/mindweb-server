import * as app from "../app";
import {AbstractRequest} from "./AbstractRequest";
import TextResponse from "../responses/TextResponse";
import KafkaService from "../services/KafkaService";
import AbstractResponse from "../responses/AbstractResponse";
import ErrorResponse from "../responses/ErrorResponse";
import FileService from "../services/FileService";
import ServiceError from "map-editor/dist/classes/ServiceError";
import File from "../classes/File";

export default class UnsubscribeRequest extends AbstractRequest {
    static initialized: boolean;
    static fileService: FileService;

    fileId: string;

    constructor(fileId: string) {
        super();
        this.fileId = fileId;
    }

    execute(userId: string, kafkaService: KafkaService, next: (response: AbstractResponse) => void) {
        if (!UnsubscribeRequest.initialized) {
            UnsubscribeRequest.fileService = new FileService(app.cassandraClient);
            UnsubscribeRequest.initialized = true;
        }
        const sessionId = this.sessionId;
        const fileId = this.fileId;

        UnsubscribeRequest.fileService.getFile(fileId, function (error: ServiceError, file: File) {
            if (error) {
                next(new ErrorResponse(error));
                return;
            }
            if (!file.canView(userId)) {
                next(new ErrorResponse({name: "Permission denied", message: "User cannot read file"}));
                return;
            }
            kafkaService.unsubscribeToFile(sessionId, fileId, function (error: Error) {
                let response;
                if (error) {
                    response = new ErrorResponse(error);
                } else {
                    response = new TextResponse("Unsubscribe done");
                    response.result = "ok";
                }
                next(response);
            })
        });
    }
}