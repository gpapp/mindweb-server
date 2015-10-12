/// <reference path="typings/tsd.d.ts" />
import * as async from 'async';
import * as fs from 'fs';
import * as path from 'path';
import * as cassandra from 'cassandra-driver';

import ServiceError from './classes/ServiceError';
import DbKeyspace from './db/keyspace'

import routes from './routes/index';
import AuthRoute from './routes/auth';
import FileRoute from './routes/file';

// Let's go oldschool with some imports
import * as session from 'express-session';
import * as express from 'express';
import * as passport from 'passport';
import * as logger from 'morgan';

var options;
var cassandraOptions:cassandra.client.Options;


var app = express();
var authRoute;
var fileRoute;

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
                "port": options.db.port
            },
            keyspace: "",
            authProvider: {
                username: "",
                password: ""
            }
        };
        DbKeyspace(cassandraOptions, next);
    },
    function (next) {
        cassandraOptions.keyspace = "mindweb";
        next();
    },
    function (next) {
        authRoute = new AuthRoute(cassandraOptions, options.url, next);
    },
    function (next) {
        fileRoute = new FileRoute(cassandraOptions, next);
    },
    function (next) {
        // view engine setup
        app.set('views', path.join(__dirname, 'views'));
        app.set('view engine', 'jade');

        // uncomment after placing your favicon in /public
        //app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
        app.use(logger('dev'));
        app.use(express.static(path.join(__dirname, 'public')));

        var CassandraStore = require("cassandra-store")(session);

        var cassandraStore = new CassandraStore(cassandraOptions);
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
        app.use('/file', AuthRoute.authorizeMiddleware, fileRoute.getRouter());

        // catch 404 and forward to error handler
        app.use(function (req, res, next) {
            var err = new ServiceError(404, 'Page not found', 'Not Found');
            next(err);
        });

        // error handlers

        // development error handler
        // will print stacktrace
        if (app.get('env') === 'development') {
            app.use(function (err:ServiceError, req, res, next) {
                res.status(err.statusCode || 500);
                res.render('error', {
                    message: err.message,
                    error: err
                });
            });
        }

        // production error handler
        // no stacktraces leaked to user
        app.use(function (err:ServiceError, req, res, next) {
            res.status(err.statusCode || 500);
            res.render('error', {
                message: err.message,
                error: {}
            });
        });
    }
]);

function nocache(req, res, next) {
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');
    next();
}

function processConfig() {
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

module.exports = app;
