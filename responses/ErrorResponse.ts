import AbstractResponse from "./AbstractResponse";
/**
 * Created by gpapp on 2016.12.30..
 */
export default class ErrorResponse extends AbstractResponse {
    errorName: string;
    errorMessage: string;

    constructor(e?: Error) {
        super();
        this.result = "error";
        if (e) {
            this.errorName = e.name;
            this.errorMessage = e.message;
        }
    }
}