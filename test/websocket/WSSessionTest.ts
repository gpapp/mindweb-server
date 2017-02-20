/**
 * Created by gpapp on 2016.12.30..
 */
import {assert} from "chai";
import * as http from "http";
import * as websocket from "websocket";
import {IMessage} from "websocket";
import * as cassandra from "cassandra-driver";
import WSServer from "../../services/WSServer";
import ResponseFactory from "mindweb-request-classes/dist/response/ResponseFactory";
import AbstractResponse from "mindweb-request-classes/dist/response/AbstractResponse";
import EchoResponse from "mindweb-request-classes/dist/response/TextResponse";
import EchoRequestImpl from "../../requestImpl/EchoRequestImpl";

const ORIGIN = "http://myorigin:8080";
const PORT = 18083;
const SESSION_ID = "SESSION-TEST-1234567890";
let cassandraClient: cassandra.Client;
let wsServer: WSServer;

const app = require("../../app");

before(function (next) {
    app.initialize(next);
});
before(function (next) {
    const options = app.options;
    console.log('Expecting DB on ' + options.db.host + ':' + options.db.port);
    cassandraClient = new cassandra.Client({
        contactPoints: [
            options.db.host
        ],
        protocolOptions: {
            "port": options.db.port as number,
            "maxSchemaAgreementWaitSeconds": 5,
            "maxVersion": 0
        },
        keyspace: "mindweb",
    });
    next();
});

before(function (next) {
    const httpServer = http.createServer(function (request, response) {
        console.log((new Date()) + ' Received request for ' + request.url);
        response.writeHead(404);
        response.end();
    });
    httpServer.listen(PORT, function () {
        console.log((new Date()) + ' Server is listening on port ' + PORT);
        wsServer = new WSServer(httpServer, ORIGIN);
        next();
    });
});
before(function (next) {
    cassandraClient.execute(
        "insert into mindweb.sessions (sid,session) values (:sessionId,:session)",
        {sessionId: SESSION_ID, session: JSON.stringify({user: "Pumukli"})}, {}, next
    );
});

describe('WebSocket session tests', function () {

    it("Connects with socket to server without session", function (done) {
        let client: websocket.client = new websocket.client();
        client.on('connectFailed', function (err) {
            done();
        });
        client.on('connect', function (connection: websocket.connection) {
            assert.ok(false, 'Connection should not be established');
            done();
        });
        client.connect('ws://localhost:18083');
    });
    it("Connects with socket to server with invalid session", function (done) {
        let client: websocket.client = new websocket.client();
        client.on('connectFailed', function (err) {
            assert.isNotNull(err, 'Connection should not fail');
            done();
        });
        client.on('connect', function (connection: websocket.connection) {
            connection.on('error', function (error: Error) {
                assert.fail('got error' + error.message);
            });
            connection.on('close', function () {
                done();
            });
            connection.on('message', function (message: IMessage) {
                assert.isNotNull(message, "Message cannot be empty");
                assert.equal("utf8", message.type, "Message type must be utf8");
                assert.isNotNull(message.utf8Data, "Message body must exist");
                const response: AbstractResponse = ResponseFactory.create(message);
                assert.equal("TextResponse", response.name);
                assert.instanceOf(response, EchoResponse);
                const echoResponse: EchoResponse = response as EchoResponse;
                assert.equal("Blabla", echoResponse.message);
                connection.close();
            });
            connection.send(JSON.stringify(new EchoRequestImpl("Blabla")));

        });
        client.connect('ws://localhost:' + PORT + "?mindweb-session=BAD_ID", "mindweb-protocol", "http://myorigin:8080");
    });

    it("Connects with socket to server with valid session", function (done) {
        const client: websocket.client = new websocket.client();
        client.on('connectFailed', function (err) {
            assert.ok(false, 'Connection should not fail');
            done();
        });
        client.on('connect', function (connection: websocket.connection) {
            connection.on('error', function (error: Error) {
                assert.fail('got error' + error.message);
            });
            connection.on('close', function () {
                done();
            });
            connection.on('message', function (message: IMessage) {
                assert.isNotNull(message, "Message cannot be empty");
                assert.equal("utf8", message.type, "Message type must be utf8");
                assert.isNotNull(message.utf8Data, "Message body must exist");
                const response: AbstractResponse = ResponseFactory.create(message);
                assert.equal("TextResponse", response.name);
                assert.instanceOf(response, EchoResponse);
                const echoResponse: EchoResponse = response as EchoResponse;
                assert.equal("Blabla", echoResponse.message);
                connection.close();
            });
            connection.send(JSON.stringify(new EchoRequestImpl("Blabla")));
        });
        client.connect('ws://localhost:' + PORT + '?mindweb-session=' + SESSION_ID, "mindweb-protocol", "http://myorigin:8080");

    });
});
after(function (next) {
    wsServer.shutdown();
    next();
});
after(function (next) {
    cassandraClient.execute(
        "delete from mindweb.sessions where sid=:sessionId",
        {sessionId: SESSION_ID}, {}, next
    );
});