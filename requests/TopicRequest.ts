import AbstractResponse from "../responses/AbstractResponse";
import {AbstractRequest} from "./AbstractRequest";
import KafkaService from "../services/KafkaService";
/**
 * Created by gpapp on 2016.12.30..
 */
export default class TopicRequest extends AbstractRequest {
    topic: string;
    value: any;

    constructor(topic?: string, value?: any) {
        super("TopicRequest");
        this.topic = topic;
        this.value = value;
    }

    execute(userId: string, kafkaService: KafkaService, callback: (response: AbstractResponse) => void): void {

    }

}