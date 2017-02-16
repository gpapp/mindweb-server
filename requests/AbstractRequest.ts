import {connection, IStringified} from "websocket";
import AbstractResponse from "../responses/AbstractResponse";
import ErrorResponse from "../responses/ErrorResponse";
import KafkaService from "../services/KafkaService";

export abstract class AbstractRequest {
    public sessionId:string;
    private name: string;

    abstract execute(userId: string, kafkaService: KafkaService, callback: (response: AbstractResponse) => void): void;

    constructor() {
        this.name = this.constructor.name;
    }

    public do(sessionId: string, userId: string, kafkaService: KafkaService, callback: (response: IStringified) => void): void {
        var response: AbstractResponse;
        this.sessionId=sessionId;
        try {
            this.execute(userId, kafkaService, function (response: AbstractResponse) {
                callback(JSON.stringify(response));
            });
        } catch (e) {
            callback(JSON.stringify(new ErrorResponse(e)));
        }

    }
}