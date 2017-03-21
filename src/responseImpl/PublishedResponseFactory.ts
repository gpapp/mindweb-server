import {KeyedMessage} from "kafka-node";
import {AbstractMessage} from "mindweb-request-classes";
import ResponseFactory from "mindweb-request-classes/service/ResponseFactory";
import PublishedResponse from "./PublishedResponse";
/**
 * Created by gpapp on 2017.02.01..
 */
export default class PublishedResponseFactory {

    static create(message: KeyedMessage): PublishedResponse {
        const payload = JSON.parse(message['value']);

        const rawMessage = payload._message;
        const sessionId = payload._originSessionId;

        const newClass: AbstractMessage = ResponseFactory.instance.create(JSON.stringify(rawMessage));
        return new PublishedResponse(sessionId, newClass);
    }
}