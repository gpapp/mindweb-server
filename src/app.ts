import * as session from "express-session";
import * as express from "express";
import * as passport from "passport";
import * as async from "async";
import * as fs from "fs";
import * as path from "path";
import * as cassandra from "cassandra-driver";
import DbKeyspace from "./db/keyspace";
import CoreSchema from "./db/core_schema";
import BaseRouter from "./routes/BaseRouter";
import IndexRoute from "./routes/index";
import AuthRoute from "./routes/auth";
import MapRoute from "./routes/map";
import PublicRoute from "./routes/public";
import FriendRoute from "./routes/friend";
import TaskRoute from "./routes/task";
import * as logger from "express-logger";
import {ServiceError} from "mindweb-request-classes";
const CassandraStore = require("cassandra-store");

export let options;
let cassandraOptions: cassandra.ClientOptions;

export const app = express();
export let cassandraClient: cassandra.Client;

export function initialize(done) {
    async.waterfall([
        function (next) {
            options = processConfig();
            next();
        },
        function (next) {
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
            DbKeyspace(cassandraOptions, next);
        },
        function (next) {
            cassandraOptions.keyspace = "mindweb";
            cassandraClient = new cassandra.Client(cassandraOptions);
            cassandraClient.connect(function (error) {
                if (error) {
                    console.error(error);
                    throw new Error('Cannot connect to database');
                }
                console.log('Building session schema');
                CoreSchema(cassandraClient, next);
            });
        },

        function () {
            done();
        }]);
}

async.waterfall([
    function (next) {
        initialize(next);
    },
    function (next) {
        const _cassandraStore = new CassandraStore({client: cassandraClient});
        const authRoute: AuthRoute = new AuthRoute(cassandraClient, options.url);
        const publicRoute: PublicRoute = new PublicRoute(cassandraClient);
        const mapRoute: MapRoute = new MapRoute(cassandraClient);
        const friendRoute: FriendRoute = new FriendRoute(cassandraClient);
        const taskRoute: TaskRoute = new TaskRoute(cassandraClient);

        console.log("All set up, starting web server");
        // view engine setup
        app.set('views', path.join(__dirname, 'views'));
        app.set('view engine', 'pug');

        // uncomment after placing your favicon in /public
        //app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
        app.use(logger({path: 'logs/current.log'}));
        app.use(express.static(path.join(__dirname, 'public')));

        app.set('trust proxy', 1); // trust first proxy
        app.set('cassandraStore',_cassandraStore);
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

        app.use('/', IndexRoute);
        app.use('/auth', authRoute.getRouter());
        app.use('/public', publicRoute.getRouter());
        app.use('/map', BaseRouter.ensureAuthenticated, mapRoute.getRouter());
        app.use('/friend', BaseRouter.ensureAuthenticated, friendRoute.getRouter());
        app.use('/task', BaseRouter.ensureAuthenticated, taskRoute.getRouter());

        // catch 404 and forward to error handler
        app.use(function (req, res, next) {
            next(new ServiceError(404, 'Page not found', 'Not Found'));
        });

        // error handlers

        // development error handler
        // will print stacktrace
        if (app.get('env') === 'development') {
            app.use(function (err: ServiceError, req, res, next2) {
                res.status(err.statusCode || 500);
                res.render('error', {
                    message: err.message,
                    error: err
                });
                next2();
            });
        }

        // production error handler
        // no stacktraces leaked to user
        app.use(function (err: ServiceError, req, res, next2) {
            res.status(err.statusCode || 500);
            res.render('error', {
                message: err.message,
                error: {}
            });
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
