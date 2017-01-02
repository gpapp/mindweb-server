import {AbstractRequest} from "./AbstractRequest";
import EchoResponse from "../responses/TextResponse";
import KafkaService from "../services/KafkaService";
import AbstractResponse from "../responses/AbstractResponse";

export default class EchoRequest extends AbstractRequest {
    content: string;

    constructor(content?: string) {
        super("EchoRequest");
        this.content = content;
    }

    execute(userId: string, kafkaService: KafkaService, next: (response: AbstractResponse) => void) {
        const response = new EchoResponse(this.content);
        response.result = "ok";
        next(response);
    }

}