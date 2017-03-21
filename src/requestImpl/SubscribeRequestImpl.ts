import * as app from "../app";
import SubscribeRequest from 'mindweb-request-classes/dist/request/SubscribeRequest';
import AbstractResponse from "mindweb-request-classes/dist/response/AbstractResponse";
import TextResponse from "mindweb-request-classes/dist/response/TextResponse";
import ErrorResponse from "mindweb-request-classes/dist/response/ErrorResponse";
import KafkaService from "../services/KafkaService";
import FileService from "../services/FileService";
import ServiceError from "mindweb-request-classes/dist/classes/ServiceError";
import File from "mindweb-request-classes/dist/classes/File";


export default class SubscribeRequestImpl extends SubscribeRequest {
    static fileService: FileService;
    static initialized: boolean;

    constructor(fileId: string) {
        super(fileId);
    }

    execute(userId: string, kafkaService: KafkaService, next: (response: AbstractResponse) => void) {
        if (!SubscribeRequestImpl.initialized) {
            SubscribeRequestImpl.fileService = new FileService(app.cassandraClient);
            SubscribeRequestImpl.initialized = true;
        }
        const fileId = this as SubscribeRequest.fileId;
        const sessionId = this as SubscribeRequest.sessionId;
        SubscribeRequest.fileService.getFile(fileId, function (error: ServiceError, file: File) {
            if (error) {
                next(new ErrorResponse(error));
                return;
            }
            if (!file.canView(userId)) {
                next(new ErrorResponse({name: "Permission denied", message: "User cannot read file"}));
                return;
            }
            kafkaService.subscribeToFile(sessionId, userId, fileId, function (error: Error) {
                let response;
                if (error) {
                    response = new ErrorResponse(error);
                } else {
                    response = new TextResponse("Subscription done");
                    response.result = "ok";
                }
                next(response);
            });
        });
    }

}