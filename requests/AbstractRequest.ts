import {IStringified} from "websocket";
import AbstractResponse from "../responses/AbstractResponse";
import ErrorResponse from "../responses/ErrorResponse";

export abstract class AbstractRequest {
    private name: string;

    abstract execute(): AbstractResponse;

    constructor(name: string) {
        this.name = name;
    }

    public do(): IStringified {
        var response: AbstractResponse;
        try {
            response = this.execute();
        } catch (e) {
            response = new ErrorResponse(e);
        }
        return JSON.stringify(response);
    }
}