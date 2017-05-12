/**
 * Created by gpapp on 2016.12.30..
 */
import * as http from "http";
import * as websocket from "websocket";
import {IMessage, connection, IStringified} from "websocket";
import {AbstractRequest, AbstractMessage} from "mindweb-request-classes";
import KafkaService from "./KafkaService";
import {app, cassandraClient, options} from "../app";
import PublishedResponseFactory from "../responseImpl/PublishedResponseFactory";
import RequestFactory from "../requestImpl/RequestFactory";
import PublishedResponse from "../responseImpl/PublishedResponse";
import {KeyedMessage} from "kafka-node";
const CassandraStore = require("cassandra-store");

export default class WSServer {
    private webSocketServer: websocket.server;
    private static url: string;

    constructor(server: http.Server, url: string) {
        this.webSocketServer = new websocket.server({
            httpServer: server,
            autoAcceptConnections: false
        });
        this.webSocketServer.on('request', this.handleRequest);
        WSServer.url = url;
    }

    private static isOriginAllowed(origin: string): boolean {
        return origin == WSServer.url;
    }

    private handleRequest(request: websocket.request) {

        if (!WSServer.isOriginAllowed(request.origin)) {
            console.log((new Date()) + " Connection rejected from: " + request.origin);
            request.reject(203, "Origin not allowed");
            return;
        }
        let sessionId: string;
        if (!sessionId) {
            for (let i of request.cookies) {
                if (i['name'] === "mindweb_session") {
                    // Slice the first part of the string as seen in  express-session's getcookie method
                    // Slice the first part of the string as seen in cookie-signature's unsign method
                    const cs = require("cookie-signature");
                    sessionId = cs.unsign(i['value'].slice(2), options.cookie_secret);
                    break;
                }
            }
        }
        if (!sessionId) {
            const requestParams = request.resourceURL.query;
            sessionId = requestParams["mindweb-session"];
        }
        if (sessionId) {
            // find session in DB

            app.get('cassandraStore').get(sessionId, (error, session) => {
                if (error || session == null) {
                    request.reject(201, "Session not found");
                    return;
                } else {
                    if (!session.passport.user) {
                        request.reject(201, "User not found in session");
                        return;
                    }
                    const connection: connection = request.accept('mindweb-protocol', request.origin, request.cookies);
                    const kafkaService: KafkaService = new KafkaService(cassandraClient, (message: KeyedMessage) => {
                            const publishedResponse: PublishedResponse = PublishedResponseFactory.create(message);
                            const response: AbstractMessage = publishedResponse.message;
                            if (sessionId != publishedResponse.originSessionId) {
                                connection.send(JSON.stringify(response));
                            }
                        }
                    );
                    connection.on('error', () => {
                        console.log((new Date()) + "Invalid protocol requested");
                        connection.drop(510, "Invalid protocol requested");
                        connection.close();
                    });
                    connection.on('message', (message: IMessage) => {
                        if (message.type == "utf8" && message.utf8Data != null) {
                            try {
                                const request: AbstractRequest = RequestFactory.create(message.utf8Data);
                                request.execute(sessionId, session.passport.user.id, kafkaService, (response: IStringified) => {
                                    // Edit is asynchronous, will not produce output
                                    if (response) {
                                        connection.sendUTF(JSON.stringify(response));
                                    }
                                })
                            } catch (e) {
                                connection.drop(500, "Error in client:" + e.message);
                                connection.close();
                            }
                        } else {
                            connection.drop(500, "Invalid message type or missing message body:" + message.type);
                            connection.close();
                        }
                    });
                    connection.on('close', (reasonCode: number, description) => {
                        kafkaService.closeAll(sessionId);
                        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
                    });
                }
            });
        } else {
            request.reject(201, "Session ID not found");
            return;
        }
    }


    public shutdown(next?) {
        this.webSocketServer.closeAllConnections();
    }
}