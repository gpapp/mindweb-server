import {IStringified} from "websocket";
import {AbstractRequest} from "./AbstractRequest";
import EchoResponse from "../responses/EchoResponse";

export default class EchoRequest extends AbstractRequest {
    content: string;

    constructor(content?: string) {
        super("EchoRequest");
        this.content = content;
    }

    execute(): EchoResponse {
        var response = new EchoResponse(this.content);
        response.result = "ok"
        return response;
    }

}