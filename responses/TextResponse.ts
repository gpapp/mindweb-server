import AbstractResponse from "./AbstractResponse";
/**
 * Created by gpapp on 2016.12.30..
 */
export default class TextResponse extends AbstractResponse {
    message: string;

    constructor(msg?: string) {
        super("TextResponse");
        this.message = msg;
    }
}
