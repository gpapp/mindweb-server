import * as express from 'express';
import ServiceError from 'map-editor/dist/classes/ServiceError';

export default class BaseRouter {
    private _router;

    protected get router() {
        return this._router;
    }

    constructor() {
        this._router = express.Router();
    }

    public static ensureAuthenticated(request, response, next) {
        if (!request.isAuthenticated()) {
            next(new ServiceError(401, 'The user has no authentication information', "Authentication failed"));
        }
        return next(null, request, response);
    }

    public getRouter():express.Router {
        return this.router;
    }
}