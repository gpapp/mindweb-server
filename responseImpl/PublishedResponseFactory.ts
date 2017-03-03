import {KeyedMessage} from "kafka-node";
import PublishedResponse from "mindweb-request-classes/dist/response/PublishedResponse";
import AbstractResponse from "mindweb-request-classes/dist/response/AbstractResponse";
import ResponseFactory from "mindweb-request-classes/dist/service/ResponseFactory";
/**
 * Created by gpapp on 2017.02.01..
 */
export default class PublishedResponseFactory {
    originSessionId: string;
    response: AbstractResponse;

    constructor(originSessionId: string, payload: AbstractResponse) {
        this.originSessionId = originSessionId;
        this.response = payload;
    }

    static create(message: KeyedMessage): PublishedResponse {
        const payload = JSON.parse(message['value']);
        payload.response['fileId'] = message['topic'];
        return new PublishedResponse(payload['originSessionId'], ResponseFactory.create({
            type: 'utf8',
            utf8Data: JSON.stringify(payload['response'])
        }));
    }
}