import AbstractResponse from "./AbstractResponse";
/**
 * Created by gpapp on 2016.12.30..
 */
export default class EchoResponse extends AbstractResponse {
    message: string;

    constructor(msg: string) {
        super("EchoResponse");
        this.message = msg;
    }
}
