import AbstractResponse from "./AbstractResponse";
import EditAction from "map-editor/dist/classes/EditAction";
/**
 * Created by gpapp on 2016.12.30..
 */
export default class EditResponse extends AbstractResponse {
    action: EditAction;

    constructor(action: EditAction) {
        super();
        this.action = action;
    }
}
