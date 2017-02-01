import {IMessage} from "websocket";
import AbstractResponse from "./AbstractResponse";

export default class ResponseFactory {

    static create(message: IMessage): AbstractResponse {
        const payload = JSON.parse(message.utf8Data);

        if (!payload.name || !/^[$_a-z][$_a-z0-9.]*$/i.test(payload.name)) {
            throw new Error("Invalid payload class");
        }
        const cmdClass = require("./" + payload.name);
        const newclass = new cmdClass.default();
        if (!(newclass instanceof AbstractResponse)) {
            throw new Error("Invalid payload class");
        }
        for (let prop  in payload) {
            if (payload.hasOwnProperty(prop)) {
                newclass[prop] = payload[prop];
            }
        }
        return newclass;
    }
}