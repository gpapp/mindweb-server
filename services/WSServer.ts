/**
 * Created by gpapp on 2016.12.30..
 */
import * as http from "http";
import * as websocket from "websocket";
import {IMessage, connection, IStringified} from "websocket";
import RequestFactory from "../requests/RequestFactory";
import {AbstractRequest} from "../requests/AbstractRequest";
import KafkaService from "./KafkaService";
import {cassandraClient, cassandraStore} from "../app";
import ResponseFactory from "../responses/ResponseFactory";
import AbstractResponse from "../responses/AbstractResponse";
import PublishedResponse from "../responses/PublishedResponse";

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
        const requestParams = request.resourceURL.query;
        const sessionId = requestParams["mindweb-session"];
        if (sessionId) {
            // find session in DB
            cassandraStore.get(sessionId, function (error, session) {
                if (error || session == null) {
                    request.reject(201, "Session not found");
                    return;
                } else {
                    if (!session.user) {
                        request.reject(201, "User not found in session");
                        return;
                    }
                    const connection: connection = request.accept('mindweb-protocol', request.origin, request.cookies);
                    const kafkaService: KafkaService = new KafkaService(cassandraClient, function (message) {
                            const publishedResponse: PublishedResponse = PublishedResponse.create(message);
                            const response: AbstractResponse = publishedResponse.response;
                            if (sessionId != publishedResponse.originSessionId) {
                                connection.send(JSON.stringify(response));
                            }
                        }
                    );
                    connection.on('error', function () {
                        console.log((new Date()) + "Invalid protocol requested");
                        connection.drop(510, "Invalid protocol requested");
                        connection.close();
                    });
                    connection.on('message', function (message: IMessage) {
                        if (message.type == "utf8" && message.utf8Data != null) {
                            try {
                                var request: AbstractRequest = RequestFactory.create(message);
                                request.do(sessionId, session.user, kafkaService, function (response: IStringified) {
                                    connection.sendUTF(response);
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
                    connection.on('close', function (reasonCode: number, description) {
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