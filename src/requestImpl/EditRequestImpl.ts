import {AbstractResponse, EditAction, EditRequest} from "mindweb-request-classes";
import KafkaService from "../services/KafkaService";
import NullResponse from "mindweb-request-classes/response/NullResponse";
import ErrorResponse from "mindweb-request-classes/response/ErrorResponse";

export default class EditRequestImpl extends EditRequest {
    constructor(fileId: string, action: EditAction) {
        super(fileId, action);
    }

    internalExecute(userId: string, kafkaService: KafkaService, next: (response: AbstractResponse) => void) {
        const fileId: string = (this as EditRequest).fileId;
        const action: EditAction = (this as EditRequest).action;
        const sessionId: string = (this as EditRequest).sessionId;

        kafkaService.sendUpdateToFile(sessionId, userId, fileId, action, (error: Error) => {
            let response;
            if (error) {
                return next(new ErrorResponse(error));
            }
            return next(new NullResponse(fileId));
        });
    }

}