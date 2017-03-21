import * as app from "../app";
import {
    SubscribeRequest,
    AbstractResponse,
    MapContainer, ServiceError
} from "mindweb-request-classes";
import KafkaService from "../services/KafkaService";
import FileService from "../services/MapService";
import ErrorResponse from "mindweb-request-classes/response/ErrorResponse";
import SubscribeResponse from "mindweb-request-classes/response/SubscribeResponse";

export default class SubscribeRequestImpl extends SubscribeRequest {
    static fileService: FileService;
    static initialized: boolean;

    constructor(fileId: string) {
        super(fileId);
    }

    internalExecute(userId: string, kafkaService: KafkaService, next: (response: AbstractResponse) => void) {
        if (!SubscribeRequestImpl.initialized) {
            SubscribeRequestImpl.fileService = new FileService(app.cassandraClient);
            SubscribeRequestImpl.initialized = true;
        }
        const fileId = this.fileId;
        const sessionId = this.sessionId;
        SubscribeRequestImpl.fileService.getMap(fileId, function (error: ServiceError, mapContainer: MapContainer) {
            if (error) {
                next(new ErrorResponse(error));
                return;
            }
            if (!mapContainer.canView(userId)) {
                next(new ErrorResponse({name: "Permission denied", message: "User cannot read mapDAO"}));
                return;
            }
            kafkaService.subscribeToFile(sessionId, userId, fileId, function (error: Error) {
                let response;
                if (error) {
                    response = new ErrorResponse(error);
                } else {
                    response = new SubscribeResponse(mapContainer);
                }
                next(response);
            });
        });
    }

}