/**
 * Created by gpapp on 2016.12.30..
 */
import {assert} from "chai";
import * as http from "http";
import * as websocket from "websocket";
import {IMessage} from "websocket";
import * as app from "../../app";
import WSServer from "../../services/WSServer";
import {AbstractMessage} from "mindweb-request-classes";
import ResponseFactory from "mindweb-request-classes/service/ResponseFactory";
import SubscribeRequestImpl from "../../requestImpl/SubscribeRequestImpl";
import JoinResponse from "mindweb-request-classes/response/JoinResponse";

const ORIGIN = "http://myorigin:8080";
const PORT = 18082;
const SESSION_ID = "SESSION-TEST-1234567890";
let wsServer: WSServer;


before((next) => {
    app.initialize(next);
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
    app.cassandraClient.execute(
        "insert into mindweb.sessions (sid,session) values (:sessionId,:session)",
        {sessionId: SESSION_ID, session: JSON.stringify({passport: {user: "Pumukli"}})}, {}, next
    );
});
describe('WebSocket connection tests', () => {

    it("Connects with socket to server without origin", (done) => {
        let client: websocket.client = new websocket.client();
        client.on('connectFailed', (err) => {
            assert.isNotNull(err, 'Connection should fail');
            done();
        });
        client.on('connect', (connection: websocket.connection) => {
            assert.ok(false, 'Connection should not be established');
            connection.close();
            done();
        });
        client.connect('ws://localhost:' + PORT + '?mindweb-session=' + SESSION_ID + '?mindweb-session=' + SESSION_ID);
    });


    it("Connects with socket to server and sends bad command", (done) => {
        const client: websocket.client = new websocket.client();
        client.on('connectFailed', (err) => {
            assert.ok(false, 'Connection should not fail');
            done();
        });
        client.on('connect', (connection: websocket.connection) => {
            connection.on('error', (error: Error) => {
                assert.fail('got error' + error.message);

                connection.close();
            });
            connection.on('close', () => {
                done();
            });
            connection.on('message', (message: IMessage) => {
                assert.isNotNull(message, "Message cannot be empty");
                assert.equal("utf8", message.type, "Message type must be utf8");
                assert.isNotNull(message.utf8Data, "Message body must exist");
                try {
                    let command: AbstractMessage = ResponseFactory.create(message.utf8Data);
                } catch (e) {
                    assert.equal("Invalid payload class", e.message);
                }
                connection.close();
            });
            connection.send(JSON.stringify({}));
        });

        client.connect('ws://localhost:' + PORT + '?mindweb-session=' + SESSION_ID, "mindweb-protocol", ORIGIN);

    });
    it("Connects with socket to server and sends an echo command", (done) => {
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
                try {
                    const response: AbstractMessage = ResponseFactory.create(message.utf8Data);
                    assert.instanceOf(response, JoinResponse);
                    const joinResponse: JoinResponse = response as JoinResponse;
                    assert.equal("Blabla", joinResponse.fileId);
                } catch (e) {
                    assert.ok(false, "Error:" + e);
                }
                connection.close();
            });
            const echoRequest = new SubscribeRequestImpl("Blabla");
            echoRequest['name']='EchoRequest';
            connection.send(JSON.stringify(echoRequest));
        });

        client.connect('ws://localhost:' + PORT + '?mindweb-session=' + SESSION_ID, "mindweb-protocol", ORIGIN);

    });
    it("Connects with socket to server and sends many echo commands", function(done)  {
        const msgCount=1000;
        this.timeout(30000);
        const client: websocket.client = new websocket.client();
        client.on('connectFailed', (err) => {
            assert.ok(false, 'Connection should not fail');
            done();
        });
        let pos = 0;
        client.on('connect', (connection: websocket.connection) => {
            connection.on('error', (error: Error) => {
                assert.fail('got error' + error.message);
            });
            connection.on('close', () => {
                assert.equal(msgCount, pos, "Should get "+msgCount+" messages");
                done();
            });
            connection.on('message', (message: IMessage) => {

                assert.isNotNull(message, "Message cannot be empty");
                assert.equal("utf8", message.type, "Message type must be utf8");
                assert.isNotNull(message.utf8Data, "Message body must exist");
                try {
                    const response: AbstractMessage = ResponseFactory.create(message.utf8Data);
                    assert.instanceOf(response, JoinResponse);
                    const joinResponse: JoinResponse = response as JoinResponse;
                    assert.equal("Blabla" + pos, joinResponse.fileId);
                } catch (e) {
                    assert.ok(false, "Error:" + e);
                }
                if (pos == msgCount) {
                    connection.close();
                } else {
                    pos++;
                    echoRequest['_content']='Blabla'+pos;
                    connection.send(JSON.stringify(echoRequest));
                }
            });
            const echoRequest = new SubscribeRequestImpl("Blabla" + 0);
            echoRequest['name']='EchoRequest';
            connection.send(JSON.stringify(echoRequest));
        });

        client.connect('ws://localhost:' + PORT + '?mindweb-session=' + SESSION_ID, "mindweb-protocol", ORIGIN);

    });
});
after((next) => {
    wsServer.shutdown();
    next();
});
after((next) => {
    app.cassandraClient.execute(
        "delete from mindweb.sessions where sid=:sessionId",
        {sessionId: SESSION_ID}, {}, next
    );
});