import * as app from "../app";
import {AbstractRequest} from "./AbstractRequest";
import TextResponse from "../responses/TextResponse";
import KafkaService from "../services/KafkaService";
import AbstractResponse from "../responses/AbstractResponse";
import ErrorResponse from "../responses/ErrorResponse";
import FileService from "../services/FileService";
import ServiceError from "map-editor/dist/classes/ServiceError";
import File from "../classes/File";


export default class SubscribeRequest extends AbstractRequest {
    static initialized: boolean;
    static fileService: FileService;
    fileId: string;

    constructor(fileId: string) {
        super();
        this.fileId = fileId;
    }

    execute(userId: string, kafkaService: KafkaService, next: (response: AbstractResponse) => void) {
        if (!SubscribeRequest.initialized) {
            SubscribeRequest.fileService = new FileService(app.cassandraClient);
            SubscribeRequest.initialized = true;
        }
        const fileId = this.fileId;
        const sessionId = this.sessionId;
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