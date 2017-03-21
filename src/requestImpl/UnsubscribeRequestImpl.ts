import * as app from "../app";
import UnsubscribeRequest from 'mindweb-request-classes/dist/request/UnsubscribeRequest';
import AbstractResponse from "mindweb-request-classes/dist/response/AbstractResponse";
import TextResponse from "mindweb-request-classes/dist/response/TextResponse";
import ErrorResponse from "mindweb-request-classes/dist/response/ErrorResponse";
import KafkaService from "../services/KafkaService";
import FileService from "../services/FileService";
import ServiceError from "mindweb-request-classes/dist/classes/ServiceError";
import File from "mindweb-request-classes/dist/classes/File";

export default class UnsubscribeRequestImpl extends UnsubscribeRequest {
    static initialized: boolean;
    static fileService: FileService;

    fileId: string;

    constructor(fileId: string) {
        super();
        this.fileId = fileId;
    }

    execute(userId: string, kafkaService: KafkaService, next: (response: AbstractResponse) => void) {
        if (!UnsubscribeRequestImpl.initialized) {
            UnsubscribeRequestImpl.fileService = new FileService(app.cassandraClient);
            UnsubscribeRequestImpl.initialized = true;
        }
        const sessionId = this as UnsubscribeRequest.sessionId;
        const fileId = this.fileId;

        UnsubscribeRequestImpl.fileService.getFile(fileId, function (error: ServiceError, file: File) {
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