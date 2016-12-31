import AbstractResponse from "./AbstractResponse";
/**
 * Created by gpapp on 2016.12.30..
 */
export default class ErrorResponse extends AbstractResponse {
    error: Error;

    constructor(e: Error) {
        super("ErrorResponse");
        this.name = "ErrorResponse";
        this.result = "error";
        this.error = e;
    }
}