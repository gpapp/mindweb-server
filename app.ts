import * as session from "express-session";
import * as express from "express";
import * as passport from "passport";
import * as logger from "morgan";
import * as async from "async";
import * as fs from "fs";
import * as path from "path";
import * as cassandra from "cassandra-driver";
import ServiceError from "./classes/ServiceError";
import DbKeyspace from "./db/keyspace";
import CoreSchema from "./db/core_schema";
import BaseRouter from "./routes/BaseRouter";
import routes from "./routes/index";
import AuthRoute from "./routes/auth";
import FileRoute from "./routes/file";
import PublicRoute from "./routes/public";
import FriendRoute from "./routes/friend";
import TaskRoute from "./routes/task";

var CassandraStore = require("cassandra-store");

export let options;
var cassandraOptions: cassandra.ClientOptions;
export let cassandraStore;

export const app = express();
var cassandraClient: cassandra.Client;
var authRoute: AuthRoute;
var publicRoute: PublicRoute;
var fileRoute: FileRoute;
var friendRoute: FriendRoute;
var taskRoute: TaskRoute;

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
        function (next) {
            cassandraStore = new CassandraStore({client: cassandraClient}, next);
        },
        function (next) {
            done();
        }]);
}

async.waterfall([
    function (next) {
        initialize(next);
    },
    function (next) {
        authRoute = new AuthRoute(cassandraClient, options.url);
        next();
    },
    function (next) {
        publicRoute = new PublicRoute(cassandraClient);
        next();
    },
    function (next) {
        fileRoute = new FileRoute(cassandraClient);
        next();
    },
    function (next) {
        friendRoute = new FriendRoute(cassandraClient);
        next();
    },
    function (next) {
        taskRoute = new TaskRoute(cassandraClient);
        next();
    },
    function (next) {
        console.log("All set up, starting web server");
        // view engine setup
        app.set('views', path.join(__dirname, 'views'));
        app.set('view engine', 'jade');

        // uncomment after placing your favicon in /public
        //app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
        app.use(logger('dev'));
        app.use(express.static(path.join(__dirname, 'public')));

        app.use(session({
            secret: 'J;SDUKLJDFMAP[M OWIO WRXD/L SDF;KZSDVKXCD;fAdslsd:fop$##o(we)tig]',
            name: 'mindweb_session',
            cookie: {secure: false},
            resave: false,
            saveUninitialized: true,
            store: cassandraStore
        }));
        app.use(passport.initialize());
        app.use(passport.session());

        app.use(nocache);

        app.use('/', routes);
        app.use('/auth', authRoute.getRouter());
        app.use('/public', publicRoute.getRouter());
        app.use('/file', BaseRouter.ensureAuthenticated, fileRoute.getRouter());
        app.use('/friend', BaseRouter.ensureAuthenticated, friendRoute.getRouter());
        app.use('/task', BaseRouter.ensureAuthenticated, taskRoute.getRouter());

        // catch 404 and forward to error handler
        app.use(function (req, res, next) {
            var err = new ServiceError(404, 'Page not found', 'Not Found');
            next(err);
        });

        // error handlers

        // development error handler
        // will print stacktrace
        if (app.get('env') === 'development') {
            app.use(function (err: ServiceError, req, res, next) {
                res.status(err.statusCode || 500);
                res.render('error', {
                    message: err.message,
                    error: err
                });
            });
        }

        // production error handler
        // no stacktraces leaked to user
        app.use(function (err: ServiceError, req, res, next) {
            res.status(err.statusCode || 500);
            res.render('error', {
                message: err.message,
                error: {}
            });
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
    var rawConfig = fs.readFileSync('config/config.json');
    var config = rawConfig.toString();
    for (var key in process.env) {
        if (!process.env.hasOwnProperty(key)) {
            continue;
        }
        var re = new RegExp('\\$\\{' + key + '\\}', 'g');
        config = config.replace(re, process.env[key]);
    }
    return JSON.parse(config);
}

//module.exports = app;
