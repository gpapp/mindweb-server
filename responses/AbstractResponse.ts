/**
 * Created by gpapp on 2016.12.30..
 */
export default class AbstractResponse {
    fileId: string;
    result: string;
    name: string;

    constructor() {
        this.name = this.constructor.name;
    }
}
