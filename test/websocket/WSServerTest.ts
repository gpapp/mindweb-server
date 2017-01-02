/**
 * Created by gpapp on 2016.12.30..
 */
import {assert} from "chai";
import * as http from "http";
import * as websocket from "websocket";
import {IMessage} from "websocket";
import * as cassandra from "cassandra-driver";
import * as app from "../../app";
import WSServer from "../../services/WSServer";
import ResponseFactory from "../../responses/ResponseFactory";
import EchoRequest from "../../requests/EchoRequest";
import AbstractResponse from "../../responses/AbstractResponse";
import EchoResponse from "../../responses/TextResponse";

const ORIGIN = "http://myorigin:8080";
const PORT = 18082;
const SESSION_ID = "SESSION-TEST-1234567890";
let cassandraClient: cassandra.Client;
let wsServer: WSServer;


before(function (next) {
    app.initialize(next);
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
    app.cassandraClient.execute(
        "insert into mindweb.sessions (sid,session) values (:sessionId,:session)",
        {sessionId: SESSION_ID, session: JSON.stringify({user: "Pumukli"})}, {}, next
    );
});
describe('WebSocket connection tests', function () {

    it("Connects with socket to server without origin", function (done) {
        let client: websocket.client = new websocket.client();
        client.on('connectFailed', function (err) {
            assert.isNotNull(err, 'Connection should fail');
            done();
        });
        client.on('connect', function (connection: websocket.connection) {
            assert.ok(false, 'Connection should not be established');
            connection.close();
            done();
        });
        client.connect('ws://localhost:' + PORT + '?mindweb-session=' + SESSION_ID + '?mindweb-session=' + SESSION_ID);
    });


    it("Connects with socket to server and sends bad command", function (done) {
        const client: websocket.client = new websocket.client();
        client.on('connectFailed', function (err) {
            assert.ok(false, 'Connection should not fail');
            done();
        });
        client.on('connect', function (connection: websocket.connection) {
            connection.on('error', function (error: Error) {
                assert.fail('got error' + error.message);

                connection.close();
            });
            connection.on('close', function () {
                done();
            });
            connection.on('message', function (message: IMessage) {
                assert.isNotNull(message, "Message cannot be empty");
                assert.equal("utf8", message.type, "Message type must be utf8");
                assert.isNotNull(message.utf8Data, "Message body must exist");
                try {
                    let command: AbstractResponse = ResponseFactory.create(message);
                } catch (e) {
                    assert.equal("Invalid payload class", e.message);
                }
                connection.close();
            });
            connection.send(JSON.stringify({}));
        });

        client.connect('ws://localhost:' + PORT + '?mindweb-session=' + SESSION_ID, "mindweb-protocol", ORIGIN);

    });
    it("Connects with socket to server and sends an echo command", function (done) {
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
                try {
                    const response: AbstractResponse = ResponseFactory.create(message);
                    assert.equal("TextResponse", response.name);
                    assert.instanceOf(response, EchoResponse);
                    const echoResponse: EchoResponse = response as EchoResponse;
                    assert.equal("Blabla", echoResponse.message);
                } catch (e) {
                    assert.ok(false, "Error:" + e);
                }
                connection.close();
            });
            connection.send(JSON.stringify(new EchoRequest("Blabla")));
        });

        client.connect('ws://localhost:' + PORT + '?mindweb-session=' + SESSION_ID, "mindweb-protocol", ORIGIN);

    });
    it("Connects with socket to server and sends many echo commands", function (done) {
        const client: websocket.client = new websocket.client();
        client.on('connectFailed', function (err) {
            assert.ok(false, 'Connection should not fail');
            done();
        });
        let pos = -1;
        client.on('connect', function (connection: websocket.connection) {
            connection.on('error', function (error: Error) {
                assert.fail('got error' + error.message);
            });
            connection.on('close', function () {
                assert.equal(10000, pos, "Should get 5 messages");
                done();
            });
            connection.on('message', function (message: IMessage) {
                pos++;
                assert.isNotNull(message, "Message cannot be empty");
                assert.equal("utf8", message.type, "Message type must be utf8");
                assert.isNotNull(message.utf8Data, "Message body must exist");
                try {
                    const response: AbstractResponse = ResponseFactory.create(message);
                    assert.equal("TextResponse", response.name);
                    assert.instanceOf(response, EchoResponse);
                    const echoResponse: EchoResponse = response as EchoResponse;
                    assert.equal("Blabla" + pos, echoResponse.message);
                } catch (e) {
                    assert.ok(false, "Error:" + e);
                }
                if (pos == 10000) {
                    connection.close();
                }
            });
            for (let i = 0; i < 10001; i++) {
                connection.send(JSON.stringify(new EchoRequest("Blabla" + i)));
            }

        });

        client.connect('ws://localhost:' + PORT + '?mindweb-session=' + SESSION_ID, "mindweb-protocol", ORIGIN);

    });
});
after(function (next) {
    wsServer.shutdown();
    next();
});
after(function (next) {
    app.cassandraClient.execute(
        "delete from mindweb.sessions where sid=:sessionId",
        {sessionId: SESSION_ID}, {}, next
    );
});