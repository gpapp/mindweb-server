import * as app from "../app";
import KafkaService from "../services/KafkaService";
import FileService from "../services/MapService";
import {UnsubscribeRequest, AbstractResponse, ServiceError, MapContainer} from "mindweb-request-classes";
import UnsubscribeResponse from "mindweb-request-classes/response/UnsubscribeResponse";
import ErrorResponse from "mindweb-request-classes/response/ErrorResponse";

export default class UnsubscribeRequestImpl extends UnsubscribeRequest {
    static initialized: boolean;
    static fileService: FileService;

    constructor(fileId: string) {
        super(fileId);
    }

    internalExecute(userId: string, kafkaService: KafkaService, next: (response: AbstractResponse) => void) {
        if (!UnsubscribeRequestImpl.initialized) {
            UnsubscribeRequestImpl.fileService = new FileService(app.cassandraClient);
            UnsubscribeRequestImpl.initialized = true;
        }
        const sessionId = this.sessionId;
        const fileId = this.fileId;

        UnsubscribeRequestImpl.fileService.getMap(fileId, function (error: ServiceError, mapContainer: MapContainer) {
            if (error) {
                next(new ErrorResponse(error));
                return;
            }
            if (!mapContainer.canView(userId)) {
                next(new ErrorResponse({name: "Permission denied", message: "User cannot read mapDAO"}));
                return;
            }
            kafkaService.unsubscribeToFile(sessionId, fileId, function (error: Error) {
                let response;
                if (error) {
                    response = new ErrorResponse(error);
                } else {
                    response = new UnsubscribeResponse(mapContainer);
                    response.result = "ok";
                }
                next(response);
            })
        });
    }
}