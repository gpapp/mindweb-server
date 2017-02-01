import AbstractResponse from "./AbstractResponse";
import * as cassandra from "cassandra-driver"
/**
 * Created by gpapp on 2016.12.30..
 */
export default class JoinResponse extends AbstractResponse {
    userId: string|cassandra.types.Uuid

    constructor(userId: string|cassandra.types.Uuid) {
        super();
        this.userId = userId;
    }
}
