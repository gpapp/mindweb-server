import {KeyedMessage} from "kafka-node";
import {PublishedResponse, AbstractMessage} from "mindweb-request-classes";
import EchoRequestImpl from "../requestImpl/EchoRequestImpl";
import UnsubscribeRequestImpl from "../requestImpl/UnsubscribeRequestImpl";
import SubscribeRequestImpl from "../requestImpl/SubscribeRequestImpl";
import EditRequestImpl from "../requestImpl/EditRequestImpl";
import {AbstractObjectFactory} from "mindweb-request-classes/service/ResponseFactory";
/**
 * Created by gpapp on 2017.02.01..
 */
export default class PublishedResponseFactory extends AbstractObjectFactory {
    initialize() {
        this.registerClass("EchoRequest", EchoRequestImpl.constructor);
        this.registerClass("EditRequest", EditRequestImpl.constructor);
        this.registerClass("SubscribeRequest", SubscribeRequestImpl.constructor);
        this.registerClass("UnsubscribeRequest", UnsubscribeRequestImpl.constructor);
    }

    private static _instance;

    static get instance():PublishedResponseFactory{
        if (!PublishedResponseFactory._instance) {
            PublishedResponseFactory._instance=new PublishedResponseFactory();
        }
        return PublishedResponseFactory._instance;
    }

    static create(message: KeyedMessage): PublishedResponse {
        const payload = JSON.parse(message['value']);

        const rawMessage = payload._message;
        const sessionId = payload._originSessionId;

        const newClass: AbstractMessage = PublishedResponseFactory.instance.create(rawMessage);
        return new PublishedResponse(sessionId, newClass);
    }
}