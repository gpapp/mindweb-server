import {EchoRequest} from "mindweb-request-classes";
import {AbstractResponse} from "mindweb-request-classes";
import KafkaService from "../services/KafkaService";
import TextResponse from "mindweb-request-classes/response/TextResponse";

export default class EchoRequestImpl extends EchoRequest {

    constructor(content?: string) {
        super(content);
    }

    internalExecute(userId: string, kafkaService: KafkaService, next: (response: AbstractResponse) => void) {
        const response = new TextResponse(this.content);
        response.result = "ok";
        next(response);
    }

}