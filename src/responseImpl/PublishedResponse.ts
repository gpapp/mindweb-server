import {AbstractMessage} from "mindweb-request-classes/classes/AbstractMessage";
export default class PublishedResponse {
    get message(): AbstractMessage {
        return this._message;
    }

    get originSessionId(): string {
        return this._originSessionId;
    }


    constructor(private _originSessionId: string, private _message: AbstractMessage) {
    }
}