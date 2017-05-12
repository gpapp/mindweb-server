import * as app from "../app";
import {
    SubscribeRequest,
    AbstractResponse,
    MapContainer, ServiceError
} from "mindweb-request-classes";
import KafkaService from "../services/KafkaService";
import MapService from "../services/MapService";
import ErrorResponse from "mindweb-request-classes/response/ErrorResponse";
import SubscribeResponse from "mindweb-request-classes/response/SubscribeResponse";
import MapVersion from "mindweb-request-classes/classes/MapVersion";

export default class SubscribeRequestImpl extends SubscribeRequest {
    static mapService: MapService;
    static initialized: boolean;

    constructor(fileId: string) {
        super(fileId);
    }

    internalExecute(userId: string, kafkaService: KafkaService, next: (response: AbstractResponse) => void) {
        if (!SubscribeRequestImpl.initialized) {
            SubscribeRequestImpl.mapService = new MapService(app.cassandraClient);
            SubscribeRequestImpl.initialized = true;
        }
        const fileId = this.fileId;
        const sessionId = this.sessionId;
        SubscribeRequestImpl.mapService.getMap(fileId, (error: ServiceError, mapContainer: MapContainer) => {
            if (error) {
                next(new ErrorResponse(error));
                return;
            }
            if (!mapContainer.canView(userId)) {
                next(new ErrorResponse({name: "Permission denied", message: "User cannot read mapDAO"}));
                return;
            }
            kafkaService.subscribeToFile(sessionId, userId, fileId, (error: Error, version?: MapVersion) => {
                let response;
                if (error) {
                    response = new ErrorResponse(error);
                } else {
                    response = new SubscribeResponse(version);
                }
                next(response);
            }, (response:AbstractResponse) => {
                next(response);
            });
        });
    }

}