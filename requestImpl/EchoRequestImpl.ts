import EchoRequest from 'mindweb-request-classes/dist/request/EchoRequest';
import AbstractResponse from "mindweb-request-classes/dist/response/AbstractResponse";
import TextResponse from "mindweb-request-classes/dist/response/TextResponse";
import KafkaService from "../services/KafkaService";

export default class EchoRequestImpl extends EchoRequest {
    content: string;

    constructor(content?: string) {
        super();
        this.content = content;
    }

    execute(userId: string, kafkaService: KafkaService, next: (response: AbstractResponse) => void) {
        const response = new TextResponse(this.content);
        response.result = "ok";
        next(response);
    }

}