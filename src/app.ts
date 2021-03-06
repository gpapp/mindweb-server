import * as session from "express-session";
import * as express from "express";
import * as passport from "passport";
import * as async from "async";
import * as fs from "fs";
import * as cassandra from "cassandra-driver";
import DbKeyspace from "./db/keyspace";
import CoreSchema from "./db/core_schema";
import BaseRouter from "./routes/BaseRouter";
import IndexRouter from "./routes/index";
import AuthRouter from "./routes/auth";
import MapRouter from "./routes/map";
import PublicRouter from "./routes/public";
import FriendRouter from "./routes/friend";
import TaskRouter from "./routes/task";
import * as logger from "express-logger";
import {ServiceError} from "mindweb-request-classes";
const CassandraStore = require("cassandra-store");

export let options;
let cassandraOptions: cassandra.ClientOptions;

export const app = express();
export let cassandraClient: cassandra.Client;

function waitForDB(cassandraClient: cassandra.Client, ttl: number, timeout: number, next: () => void) {
    cassandraClient.connect((error) => {
        if (error) {
            if (ttl) {
                console.log('DB is not available, waiting for ' + timeout + 's');
                setTimeout(waitForDB, timeout * 1000, cassandraClient, ttl - 1, timeout * 2, next);
            } else {
                throw error;
            }
        } else {
            next();
        }
    });
}

export function initialize(done) {
    async.waterfall([
        (next) => {
            options = processConfig();
            next();
        },
        (next) => {
            cassandraOptions = {
                contactPoints: [
                    options.db.host
                ],
                protocolOptions: {
                    "port": options.db.port as number,
                    "maxSchemaAgreementWaitSeconds": 5,
                    "maxVersion": 0
                },
                keyspace: "",
            };
            const cassandraSchemaClient = new cassandra.Client(cassandraOptions);
            waitForDB(cassandraSchemaClient, 7, 1, () => {
                DbKeyspace(cassandraSchemaClient, next);
            });
        },
        (next) => {
            cassandraOptions.keyspace = "mindweb";
            cassandraClient = new cassandra.Client(cassandraOptions);
            waitForDB(cassandraClient, 3, 2, () => {
                console.log('Building session schema');
                CoreSchema(cassandraClient, next);
            });
        },
        () => {
            done();
        }]);
}

async.waterfall([
    (next) => {
        initialize(next);
    },
    (next) => {
        const _cassandraStore = new CassandraStore({client: cassandraClient});
        const authRoute: AuthRouter = new AuthRouter(cassandraClient, options.url, options.auth);
        const publicRoute: PublicRouter = new PublicRouter(cassandraClient);
        const mapRoute: MapRouter = new MapRouter(cassandraClient);
        const friendRoute: FriendRouter = new FriendRouter(cassandraClient);
        const taskRoute: TaskRouter = new TaskRouter(cassandraClient);

        console.log("All set up, starting web server");

        app.use(logger({path: 'logs/current.log'}));

        app.set('trust proxy', 1); // trust first proxy
        app.set('cassandraStore', _cassandraStore);
        app.use(session({
            secret: options.cookie_secret,
            name: 'mindweb_session',
            cookie: {secure: 'auto'},
            resave: true,
            saveUninitialized: true,
            store: _cassandraStore
        }));
        app.use(passport.initialize());
        app.use(passport.session());

        app.use(nocache);

        app.use('/', IndexRouter);
        app.use('/auth', authRoute.getRouter());
        app.use('/public', publicRoute.getRouter());
        app.use('/map', BaseRouter.ensureAuthenticated, mapRoute.getRouter());
        app.use('/friend', BaseRouter.ensureAuthenticated, friendRoute.getRouter());
        app.use('/task', BaseRouter.ensureAuthenticated, taskRoute.getRouter());

        // catch 404 and forward to error handler
        app.use((req, res, next) => {
            next(new ServiceError(404, 'Page not found', 'Not Found'));
        });

        // error handlers

        // development error handler
        // will print stacktrace
        if (app.get('env') === 'development') {
            app.use((err: ServiceError, req, res, next2) => {
                res.status(err.statusCode || 500);
                res.write(JSON.stringify(err));
                next2();
            });
        }

        // production error handler
        // no stacktraces leaked to user
        app.use((err: ServiceError, req, res, next2) => {
            res.status(err.statusCode || 500);
            res.write(JSON.stringify({
                message: err.message,
                error: {}
            }));
            next2();
        });
        next();
    }
]);

function nocache(req, res, next) {
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');
    next();
}

export function processConfig() {
    let config = fs.readFileSync('config/config.json').toString();
    for (let key in process.env) {
        if (!process.env.hasOwnProperty(key)) {
            continue;
        }
        const re = new RegExp('\\$\\{' + key + '\\}', 'g');
        config = config.replace(re, process.env[key]);
    }
    return JSON.parse(config);
}
