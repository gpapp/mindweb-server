import * as passport from "passport";
import * as cassandra from "cassandra-driver";

import {User} from "mindweb-request-classes";

import BaseRouter from "./BaseRouter";
import UserService from "../services/UserService";


export default class AuthRouter extends BaseRouter {

    private static findOrCreateUser(userService:UserService, authId, name, email, avatarUrl, next) {
        userService.getUserByAuthId(authId, (error, result: User) => {
            if (error) {
                return next(error);
            }
            if (result == null) {
                console.log('Creating user:' + authId + ':' + name + ':' + avatarUrl);
                userService.createUser(authId, name, email, avatarUrl, (error, result) => {
                    next(error, result);
                });
            } else {
                console.log('Found user:' + authId + ':' + name + ':' + avatarUrl);
                next(null, result);
            }
        });
    }

    // Documentation: @ http://passportjs.org/docs/google

    constructor(cassandraClient: cassandra.Client, BASE_URL: string, auth) {
        super();
        const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
        const TwitterStrategy = require('passport-twitter').Strategy;
        const FacebookStrategy = require('passport-facebook').Strategy;
        const LinkedInStrategy = require('passport-linkedin').Strategy;

        this.router.get('/google', passport.authenticate('google',
            {
                scope: ['https://www.googleapis.com/auth/plus.login',
                    "https://www.googleapis.com/auth/userinfo.email",
                    "https://www.googleapis.com/auth/userinfo.profile"]
            }));
        this.router.get('/google/return', passport.authenticate('google', {
            successRedirect: '/',
            failureRedirect: '/login'
        }));
        this.router.get('/twitter', passport.authenticate('twitter'));
        this.router.get('/twitter/return', passport.authenticate('twitter', {
            successRedirect: '/',
            failureRedirect: '/login'
        }));
        this.router.get('/facebook', passport.authenticate('facebook', {scope: ['public_profile', 'email']}));
        this.router.get('/facebook/return', passport.authenticate('facebook', {
            successRedirect: '/',
            failureRedirect: '/login'
        }));
        this.router.get('/linkedin', passport.authenticate('linkedin', {scope: ['r_basicprofile', 'r_emailaddress']}));
        this.router.get('/linkedin/return', passport.authenticate('linkedin', {
            successRedirect: '/',
            failureRedirect: '/login'
        }));

        this.router.get('/authenticated', BaseRouter.ensureAuthenticated, (request, response) => {
            console.log("Authentication check passed");
            response.json(request.session['passport'].user);
        });

        this.router.get('/logout', (request, response) => {
            console.log("Received session for destroy: ");
            request.logout();
            response.redirect('/');
        });

        console.log("Setting up DB connection for authentication");

        const userService = new UserService(cassandraClient);

        // Passport session setup.
        //   To support persistent login sessions, Passport needs to be able to
        //   serialize users into and deserialize users out of the session.  Typically,
        //   this will be as simple as storing the user ID when serializing, and finding
        //   the user by ID when deserializing.  However, since this example does not
        //   have a database of user records, the complete Google profile is
        //   serialized and deserialized.
        passport.serializeUser((user, done) => {
            done(null, user);
        });

        passport.deserializeUser((obj, done) => {
            done(null, obj);
        });
        
        passport.use(
            new GoogleStrategy(
                {
                    clientID: auth['google']['clientID'],
                    clientSecret: auth['google']['clientSecret'],
                    callbackURL: BASE_URL + '/auth/google/return'
                },
                (accessToken, refreshToken, profile, done) => {
                    AuthRouter.findOrCreateUser(userService,'google:' + profile.id, profile.displayName, profile.emails[0].value, profile.photos[0].value, done);
                }
            )
        );
        passport.use(
            new FacebookStrategy(
                {
                    clientID: auth['facebook']['clientID'],
                    clientSecret: auth['facebook']['clientSecret'],
                    callbackURL: BASE_URL + '/auth/facebook/return',
                    profileFields: ['id', 'displayName', 'email', 'photos']
                },
                (accessToken, refreshToken, profile, done) => {
                    AuthRouter.findOrCreateUser(userService,'facebook:' + profile.id, profile.displayName, profile.email, profile.photos[0].value, done);
                }
            )
        );
        passport.use(
            new TwitterStrategy(
                {
                    consumerKey: auth['twitter']['consumerKey'],
                    consumerSecret: auth['twitter']['consumerSecret'],
                    callbackURL: BASE_URL + '/auth/twitter/return'
                },
                (accessToken, refreshToken, profile, done) => {
                    AuthRouter.findOrCreateUser(userService,'twitter:' + profile.id, profile.displayName, profile.email, profile._json.profile_image_url_https, done);
                }
            )
        );
        passport.use(
            new LinkedInStrategy(
                {
                    consumerKey: auth['linkedin']['consumerKey'],
                    consumerSecret: auth['linkedin']['consumerSecret'],
                    callbackURL: BASE_URL + '/auth/linkedin/return',
                    profileFields: ['id', 'formatted-name', 'picture-url', 'emailAddress']
                },
                (accessToken, refreshToken, profile, done) => {
                    AuthRouter.findOrCreateUser(userService,'linkedin:' + profile.id, profile._json.formattedName, profile.emails[0].value, profile._json.pictureUrl, done);
                }
            )
        );
    };


}



