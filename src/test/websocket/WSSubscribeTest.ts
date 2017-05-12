/**
 * Created by gpapp on 2016.12.30..
 */
import {assert} from "chai";
import * as http from "http";
import * as websocket from "websocket";
import {IMessage} from "websocket";
import * as app from "../../app";
import WSServer from "../../services/WSServer";
import FileService from "../../services/MapService";
import UserService from "../../services/UserService";
import FriendService from "../../services/FriendService";
import SubscribeRequestImpl from "../../requestImpl/SubscribeRequestImpl";
import UnsubscribeRequestImpl from "../../requestImpl/UnsubscribeRequestImpl";
import EditRequestImpl from "../../requestImpl/EditRequestImpl";
import {AbstractMessage, ServiceError} from "mindweb-request-classes";
import ResponseFactory from "mindweb-request-classes/service/ResponseFactory";
import ErrorResponse from "mindweb-request-classes/response/ErrorResponse";
import JoinResponse from "mindweb-request-classes/response/JoinResponse";
import EditResponse from "mindweb-request-classes/response/EditResponse";
import UnsubscribeResponse from "mindweb-request-classes/response/UnsubscribeResponse";
import SubscribeResponse from "mindweb-request-classes/response/SubscribeResponse";
import {ActionNames} from "mindweb-request-classes/classes/EditAction";

const ORIGIN = "http://myorigin:8080";
const PORT = 18084;
const SESSION_ID1 = "SESSION-TEST-1234567890-1";
const SESSION_ID2 = "SESSION-TEST-1234567890-2";
const SESSION_ID3 = "SESSION-TEST-1234567890-3";
const FILE_CONTENT = {'$': '', 'rootNode': 'MapContainer SUBSCRIBE content'};
let wsServer: WSServer;
let userService: UserService;
let fileService: FileService;
let friendService: FriendService;

let userId1;
let userId2;
let fileId1;
let fileId2;

before((next) => {
    app.initialize(next);
});
before((next) => {
    userService = new UserService(app.cassandraClient);
    fileService = new FileService(app.cassandraClient);
    friendService = new FriendService(app.cassandraClient);
    next();
});
before((next) => {
    userService.createUser("subscribeTest:ID1", "Test Subscribe User 1", "test1@subscribe.com", "Test MapContainer Avatar 1", (error, result) => {
        if (error) {
            userService.getUserByAuthId("subscribeTest:ID1", (error, result) => {
                userId1 = result.id;
                console.log("User loaded:" + userId1);
                next();
            });
        }
        else {
            userId1 = result.id;
            console.log("User created:" + userId1);
            next();
        }
    });
});
before((next) => {
    userService.createUser("subscribeTest:ID2", "Test Subscribe User 2", "test2@subscribe.com", "Test MapContainer Avatar 1", (error, result) => {
        if (error) {
            userService.getUserByAuthId("subscribeTest:ID2", (error, result) => {
                userId2 = result.id;
                console.log("User loaded:" + userId2);
                next();
            });
        }
        else {
            userId2 = result.id;
            console.log("User created:" + userId2);
            next();
        }
    });
});
before((next) => {
    before((done) => {
        fileService.createNewVersion(userId1, "SUBSCRIBEText1", true, false, null, null, ['SUBSCRIBE-TEST'], JSON.stringify(FILE_CONTENT), (error, result) => {
            if (error) console.error(error.message);
            fileId1 = result.id;
            done();
        });
    });
    next();
});
before((next) => {
    before((done) => {
        fileService.createNewVersion(userId1, "SUBSCRIBEText2", true, false, null, null, ['SUBSCRIBE-TEST'], JSON.stringify(FILE_CONTENT), (error, result) => {
            if (error) console.error(error.message);
            fileId2 = result.id;
            done();
        });
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
    app.cassandraClient.execute(
        "insert into mindweb.sessions (sid,session) values (:sessionId,:session)",
        {sessionId: SESSION_ID1, session: JSON.stringify({passport: {user: userId1}})}, {}, next
    );
});
before((next) => {
    app.cassandraClient.execute(
        "insert into mindweb.sessions (sid,session) values (:sessionId,:session)",
        {sessionId: SESSION_ID2, session: JSON.stringify({passport: {user: userId2}})}, {}, next
    );
});
before((next) => {
    app.cassandraClient.execute(
        "insert into mindweb.sessions (sid,session) values (:sessionId,:session)",
        {sessionId: SESSION_ID3, session: JSON.stringify({passport: {user: userId2}})}, {}, next
    );
});
describe('WebSocket subscription tests', () => {

    it("Subscribes to a non-existing file", (done) => {
        const client: websocket.client = new websocket.client();
        client.on('connectFailed', (err) => {
            assert.ok(false, 'Connection should not fail');
            done();
        });
        client.on('connect', (connection: websocket.connection) => {
            connection.on('error', (error: Error) => {
                assert.fail('got error' + error.message);
                done();
            });
            connection.on('close', () => {
            });
            connection.on('message', (message: IMessage) => {
                assert.isNotNull(message, "Message cannot be empty");
                assert.equal("utf8", message.type, "Message type must be utf8");
                assert.isNotNull(message.utf8Data, "Message body must exist");
                const response: AbstractMessage = ResponseFactory.create(message.utf8Data);
                assert.instanceOf(response, ErrorResponse);
                const errorResponse: ErrorResponse = response as ErrorResponse;
                assert.equal("error", errorResponse.result);

                assert.equal("TypeError", errorResponse.errorName);
                connection.close();
                done();
            });
            const subscribeRequestImpl = new SubscribeRequestImpl("INVALID");
            subscribeRequestImpl['name'] = 'SubscribeRequest';
            connection.send(JSON.stringify(subscribeRequestImpl));
        });
        client.connect('ws://localhost:' + PORT + '?mindweb-session=' + SESSION_ID1, "mindweb-protocol", "http://myorigin:8080");
    });
    it("Subscribes to an existing file", function(done)  {
        this.timeout(12000);
        const client: websocket.client = new websocket.client();
        client.on('connectFailed', (err) => {
            assert.ok(false, 'Connection should not fail');
            done();
        });
        client.on('connect', (connection: websocket.connection) => {
            connection.on('error', (error: Error) => {
                assert.fail('got error' + error.message);
                done();
            });
            connection.on('close', () => {
            });
            connection.on('message', (message: IMessage) => {
                assert.isNotNull(message, "Message cannot be empty");
                assert.equal("utf8", message.type, "Message type must be utf8");
                assert.isNotNull(message.utf8Data, "Message body must exist");
                const response: AbstractMessage = ResponseFactory.create(message.utf8Data);
                assert.instanceOf(response, SubscribeResponse);
                const subscribeResponse: SubscribeResponse = response as SubscribeResponse;
                assert.equal("ok", subscribeResponse.result);
                assert.equal(fileId1, subscribeResponse.mapVersion.container.id);
                connection.close();
                done();
            });
            connection.send(JSON.stringify(new SubscribeRequestImpl(fileId1)));
        });
        client.connect('ws://localhost:' + PORT + '?mindweb-session=' + SESSION_ID1, "mindweb-protocol", "http://myorigin:8080");
    });
    it("Unsubscribes from a file", function(done) {
        const client: websocket.client = new websocket.client();
        client.on('connectFailed', (err) => {
            assert.ok(false, 'Connection should not fail');
            done();
        });
        client.on('connect', (connection: websocket.connection) => {
            connection.on('error', (error: Error) => {
                assert.fail('got error' + error.message);
                done();
            });
            connection.on('close', () => {
            });
            connection.on('message', (message: IMessage) => {
                assert.isNotNull(message, "Message cannot be empty");
                assert.equal("utf8", message.type, "Message type must be utf8");
                assert.isNotNull(message.utf8Data, "Message body must exist");
                const response: AbstractMessage = ResponseFactory.create(message.utf8Data);
                assert.instanceOf(response, UnsubscribeResponse);
                const unsubscribeResponse: UnsubscribeResponse = response as UnsubscribeResponse;
                assert.equal("ok", unsubscribeResponse.result);
                assert.equal(fileId1, unsubscribeResponse.mapContainer.id);
                connection.close();
                done();
            });
            const unsubscribeRequestImpl = new UnsubscribeRequestImpl(fileId1);
            unsubscribeRequestImpl['name'] = 'UnsubscribeRequest';
            connection.send(JSON.stringify(unsubscribeRequestImpl));
        });
        client.connect('ws://localhost:' + PORT + '?mindweb-session=' + SESSION_ID1, "mindweb-protocol", "http://myorigin:8080");
    });
    it("Subscribes to an existing map and send updates", function(done) {
        this.timeout(12000);
        const client1: websocket.client = new websocket.client();
        const client2: websocket.client = new websocket.client();
        let editConnection: websocket.connection;
        let receiveConnection: websocket.connection;
        client1.on('connectFailed', (err) => {
            assert.ok(false, 'Connection should not fail');
            done();
        });
        client2.on('connectFailed', (err) => {
            assert.ok(false, 'Connection should not fail');
            done();
        });
        client1.on('connect', (connection: websocket.connection) => {
            receiveConnection = connection;
            let messageCount = 0;
            connection.on('error', (error: Error) => {
                assert.fail('got error' + error.message);
                done();
            });
            connection.on('close', () => {
            });
            connection.on('message', (message: IMessage) => {
                const response: AbstractMessage = ResponseFactory.create(message.utf8Data);
                let joinResponse: JoinResponse;
                let editResponse: EditResponse;
                messageCount++;
                switch (response.constructor.name) {
                    case 'JoinResponse':
                        assert.isTrue(response instanceof JoinResponse);
                        joinResponse = response as JoinResponse;
                        assert.equal(userId1.toString(), joinResponse.userId);
                        break;
                    case 'EditResponse':
                        assert.isTrue(response instanceof EditResponse);
                        editResponse = response as EditResponse;
                        assert.equal(ActionNames.deleteNode, editResponse.action.event);
                        editConnection.close();
                        receiveConnection.close();
                        done();
                        break;
                    default:
                        assert.fail('Must not receive ' + response.constructor.name);
                }
            });
            connection.send(JSON.stringify(new SubscribeRequestImpl(fileId1)));
        });
        client2.on('connect', (connection: websocket.connection) => {
            let messageCount = 0;
            editConnection = connection;
            connection.on('error', (error: Error) => {
                assert.fail('got error' + error.message);
            });
            connection.on('close', () => {
                receiveConnection.close();
            });
            connection.on('message', (message: IMessage) => {
                const response: AbstractMessage = ResponseFactory.create(message.utf8Data);
                console.log('pipe2-' + messageCount + ':' + response.constructor.name);
                let joinResponse: JoinResponse;
                let editResponse: EditResponse;
                messageCount++;
                switch (response.constructor.name) {
                    case 'JoinResponse':
                        assert.isTrue(response instanceof JoinResponse);
                        joinResponse = response as JoinResponse;
                        assert.equal(userId1.toString(), joinResponse.userId);
                        break;
                    case 'EditResponse':
                        assert.isTrue(response instanceof EditResponse);
                        editResponse = response as EditResponse;
                        assert.equal(ActionNames.deleteNode, editResponse.action.event);
                        break;
                    default:
                        assert.fail('Must not receive ' + response.constructor.name);
                }

            });

            editConnection.send(JSON.stringify(new SubscribeRequestImpl(fileId1)));
            editConnection.send(JSON.stringify(new EditRequestImpl(fileId1, {
                event: ActionNames.deleteNode,
                parent: "root",
                payload: ""
            })));
        });

        client1.connect('ws://localhost:' + PORT + '?mindweb-session=' + SESSION_ID1, "mindweb-protocol", "http://myorigin:8080");
        client2.connect('ws://localhost:' + PORT + '?mindweb-session=' + SESSION_ID2, "mindweb-protocol", "http://myorigin:8080");
    });
});
after((next) => {
    userService.deleteUser(userId1, (error: ServiceError) => {
        next();
    });
});
after((next) => {
    userService.deleteUser(userId2, (error: ServiceError) => {
        next();
    });
});

after((next) => {
    wsServer.shutdown();
    next();
});
after((next) => {
    app.cassandraClient.execute(
        "delete from mindweb.sessions where sid=:sessionId",
        {sessionId: SESSION_ID1}, {}, next
    );
});
after((next) => {
    app.cassandraClient.execute(
        "delete from mindweb.sessions where sid=:sessionId",
        {sessionId: SESSION_ID2}, {}, next
    );
});
after((next) => {
    app.cassandraClient.execute(
        "delete from mindweb.sessions where sid=:sessionId",
        {sessionId: SESSION_ID3}, {}, next
    );
});