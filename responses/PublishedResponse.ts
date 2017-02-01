import AbstractResponse from "./AbstractResponse";
import ResponseFactory from "./ResponseFactory";
import {KeyedMessage} from "kafka-node";
/**
 * Created by gpapp on 2017.02.01..
 */
export default class PublishedResponse {
    originSessionId: string;
    response: AbstractResponse;

    constructor(originSessionId: string, payload: AbstractResponse) {
        this.originSessionId = originSessionId;
        this.response = payload;
    }

    static create(message: KeyedMessage): PublishedResponse {
        const payload = JSON.parse(message['value']);

        return new PublishedResponse(payload['originSessionId'], ResponseFactory.create({
            type: 'utf8',
            utf8Data: JSON.stringify(payload['response'])
        }));
    }
}