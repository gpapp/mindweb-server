import {IMessage} from "websocket";
import {AbstractRequest} from "./AbstractRequest";

export default class RequestFactory {

    static create(message: IMessage): AbstractRequest {
        var payload = JSON.parse(message.utf8Data);

        if (!payload.name || !/^[$_a-z][$_a-z0-9.]*$/i.test(payload.name)) {
            throw new Error("Invalid payload class");
        }
        var cmdClass = require("./" + payload.name);
        var newclass = new cmdClass.default();
        if (!(newclass instanceof AbstractRequest)) {
            throw new Error("Invalid payload class");
        }
        for (var prop  in payload) {
            if (newclass.hasOwnProperty(prop)) {
                newclass[prop] = payload[prop];
            }
        }
        return newclass;
    }
}