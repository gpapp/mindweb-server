/// <reference path="../typings/tsd.d.ts" />
import * as express from 'express';
import ServiceError from '../classes/ServiceError';

export default class BaseRouter {
    private _router;

    protected get router() {
        return this._router;
    }

    constructor() {
        this._router = express.Router();
    }

    protected static ensureAuthenticated(request, response, next) {
        if (request.session.passport.user) {
            return next(null, request, response);
        }
        next(new ServiceError(401, 'The user has no authentication information', "Authentication failed"));
    }

    public static authorizeMiddleware(request, response, next) {
        if (!request.isAuthenticated()) {
            next(new ServiceError(401, 'User is not authenticated', 'Unauthenticated user'));
        }
        next();
    }

    public getRouter():express.Router {
        return this.router;
    }
}