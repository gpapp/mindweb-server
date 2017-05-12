import UnsubscribeRequestImpl from "../requestImpl/UnsubscribeRequestImpl";
import SubscribeRequestImpl from "../requestImpl/SubscribeRequestImpl";
import EditRequestImpl from "../requestImpl/EditRequestImpl";
import {AbstractObjectFactory, AbstractRequest} from "mindweb-request-classes";
/**
 * Created by gpapp on 2017.02.01..
 */
export default class RequestFactory extends AbstractObjectFactory<AbstractRequest> {
    initialize() {
        this.registerClass("EditRequest", EditRequestImpl);
        this.registerClass("SubscribeRequest", SubscribeRequestImpl);
        this.registerClass("UnsubscribeRequest", UnsubscribeRequestImpl);
    }

    private static _instance;

    static get instance(): RequestFactory {
        if (!RequestFactory._instance) {
            RequestFactory._instance = new RequestFactory();
        }
        return RequestFactory._instance;
    }

    static create(message: string): AbstractRequest {
        return RequestFactory.instance.create(message);
    }
}