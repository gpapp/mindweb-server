/**
 * Created by gpapp on 2016.12.30..
 */
import * as http from "http";
import * as websocket from "websocket";
import {IMessage, ICookie} from "websocket";
import RequestFactory from "../requests/RequestFactory";
import {AbstractRequest} from "../requests/AbstractRequest";

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

    private static error(connection: websocket.connection, message: IMessage) {
        connection.send(JSON.stringify({result: "error", message: message}));
        connection.sendCloseFrame(501, "Invalid message", true);
    }

    private handleRequest(request: websocket.request) {
        if (!WSServer.isOriginAllowed(request.origin)) {
            console.log((new Date()) + " Connection rejected from: " + request.origin);
            request.reject(203, "Origin not allowed");
            return;
        }
        const r = request.resourceURL.query;
        if (r["mindweb-session"]) {
            // find session in DB
            const cassandraStore = require("../app").cassandraStore;

            cassandraStore.get(r["mindweb-session"], function (error, session: string) {
                if (error || session == null) {
                    request.reject(201, "Session not found");
                    return;
                } else {
                    var connection = request.accept('mindweb-protocol', request.origin, request.cookies);
                    connection.on('error', function () {
                        console.log((new Date()) + "Invalid protocol requested");
                        connection.drop(510, "Invalid protocol requested");
                        connection.close();
                    });
                    connection.on('message', function (message: IMessage) {
                        if (message.type == "utf8" && message.utf8Data != null) {
                            try {
                                var request: AbstractRequest = RequestFactory.create(message);
                                connection.sendUTF(request.do());
                            } catch (e) {
                                WSServer.error(connection, e);
                            }
                        } else
                            WSServer.error(connection, message);
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