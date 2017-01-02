import {IMessage} from "websocket";
import AbstractResponse from "./AbstractResponse";

export default class ResponseFactory {

    static create(message: IMessage): AbstractResponse {
        var payload = JSON.parse(message.utf8Data);

        if (!payload.name || !/^[$_a-z][$_a-z0-9.]*$/i.test(payload.name)) {
            throw new Error("Invalid payload class");
        }
        var cmdClass = require("./" + payload.name);
        var newclass = new cmdClass.default();
        if (!(newclass instanceof AbstractResponse)) {
            throw new Error("Invalid payload class");
        }
        for (var prop  in payload) {
            if (payload.hasOwnProperty(prop)) {
                newclass[prop] = payload[prop];
            }
        }
        return newclass;
    }
}