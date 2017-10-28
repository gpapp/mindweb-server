/**
 * Created by gpapp on 2016.12.30..
 */
import { before,describe, it, after } from "mocha";
import {assert} from "chai";
import * as http from "http";
import * as websocket from "websocket";
import {IMessage} from "websocket";
import * as cassandra from "cassandra-driver";
import WSServer from "../../services/WSServer";
import {AbstractMessage} from "mindweb-request-classes";
import ResponseFactory from "mindweb-request-classes/service/ResponseFactory";
import SubscribeRequestImpl from "../../requestImpl/SubscribeRequestImpl";
import JoinResponse from "mindweb-request-classes/response/JoinResponse";

const ORIGIN = "http://myorigin:8080";
const PORT = 18083;
const SESSION_ID = "SESSION-TEST-1234567890";
let cassandraClient: cassandra.Client;
let wsServer: WSServer;

const app = require("../../app");

before((next) => {
    app.initialize(next);
});
before((next) => {
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

before((next) => {
    const httpServer = http.createServer((request, response) => {
        console.log((new Date()) + ' Received request for ' + request.url);
        response.writeHead(404);
        response.end();
    });
    httpServer.listen(PORT, () => {
        console.log((new Date()) + ' Server is listening on port ' + PORT);
        wsServer = new WSServer(httpServer, ORIGIN);
        next();
    });
});
before((next) => {
    cassandraClient.execute(
        "insert into mindweb.sessions (sid,session) values (:sessionId,:session)",
        {sessionId: SESSION_ID, session: JSON.stringify({passport: {user: "Pumukli"}})}, {}, next
    );
});

describe('WebSocket session tests', () => {

    it("Connects with socket to server without session", (done) => {
        let client: websocket.client = new websocket.client();
        client.on('connectFailed', (err) => {
            done();
        });
        client.on('connect', (connection: websocket.connection) => {
            assert.ok(false, 'Connection should not be established');
            done();
        });
        client.connect('ws://localhost:18083');
    });
    it("Connects with socket to server with invalid session", (done) => {
        let client: websocket.client = new websocket.client();
        client.on('connectFailed', (err) => {
            assert.isNotNull(err, 'Connection should not fail');
            done();
        });
        client.on('connect', (connection: websocket.connection) => {
            connection.on('error', (error: Error) => {
                assert.fail('got error' + error.message);
            });
            connection.on('close', () => {
                done();
            });
            connection.on('message', (message: IMessage) => {
                assert.isNotNull(message, "Message cannot be empty");
                assert.equal("utf8", message.type, "Message type must be utf8");
                assert.isNotNull(message.utf8Data, "Message body must exist");
                const response: AbstractMessage = ResponseFactory.create(message.utf8Data);
                assert.instanceOf(response, JoinResponse);
                const joinResponse: JoinResponse = response as JoinResponse;
                assert.equal("Blabla", joinResponse.fileId);
                connection.close();
            });
            const echoRequest = new SubscribeRequestImpl("Blabla");
            echoRequest['name'] = 'EchoRequest';
            connection.send(JSON.stringify(echoRequest));

        });
        client.connect('ws://localhost:' + PORT + "?mindweb-session=BAD_ID", "mindweb-protocol", "http://myorigin:8080");
    });

    it("Connects with socket to server with valid session", (done) => {
        const client: websocket.client = new websocket.client();
        client.on('connectFailed', (err) => {
            assert.ok(false, 'Connection should not fail');
            done();
        });
        client.on('connect', (connection: websocket.connection) => {
            connection.on('error', (error: Error) => {
                assert.fail('got error' + error.message);
            });
            connection.on('close', () => {
                done();
            });
            connection.on('message', (message: IMessage) => {
                assert.isNotNull(message, "Message cannot be empty");
                assert.equal("utf8", message.type, "Message type must be utf8");
                assert.isNotNull(message.utf8Data, "Message body must exist");
                const response: AbstractMessage = ResponseFactory.create(message.utf8Data);
                assert.instanceOf(response, JoinResponse);
                const joinResponse: JoinResponse = response as JoinResponse;
                assert.equal("Blabla", joinResponse.fileId);
                connection.close();
            });
            connection.send(JSON.stringify(new SubscribeRequestImpl("Blabla")));
        });
        client.connect('ws://localhost:' + PORT + '?mindweb-session=' + SESSION_ID, "mindweb-protocol", "http://myorigin:8080");

    });
});
after((next) => {
    wsServer.shutdown();
    next();
});
after((next) => {
    cassandraClient.execute(
        "delete from mindweb.sessions where sid=:sessionId",
        {sessionId: SESSION_ID}, {}, next
    );
});