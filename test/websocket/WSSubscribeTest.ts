/**
 * Created by gpapp on 2016.12.30..
 */
import {assert} from "chai";
import * as http from "http";
import * as websocket from "websocket";
import {IMessage} from "websocket";
import * as app from "../../app";
import WSServer from "../../services/WSServer";
import ResponseFactory from "../../responses/ResponseFactory";
import AbstractResponse from "../../responses/AbstractResponse";
import TextResponse from "../../responses/TextResponse";
import FileService from "../../services/FileService";
import UserService from "../../services/UserService";
import FriendService from "../../services/FriendService";
import SubscribeRequest from "../../requests/SubscribeRequest";
import ServiceError from "../../classes/ServiceError";
import UnsubscribeRequest from "../../requests/UnsubscribeRequest";
import ErrorResponse from "../../responses/ErrorResponse";
import EditRequest from "../../requests/EditRequest";
import EditAction from "../../classes/EditAction";
import RequestFactory from "../../requests/RequestFactory";
import {AbstractRequest} from "../../requests/AbstractRequest";

const ORIGIN = "http://myorigin:8080";
const PORT = 18084;
const SESSION_ID = "SESSION-TEST-1234567890";

let wsServer: WSServer;
let userService: UserService;
let fileService: FileService;
let friendService: FriendService;

let userId1;
let userId2;
let fileId1;
let fileId2;

before(function (next) {
    app.initialize(next);
});
before(function (next) {
    userService = new UserService(app.cassandraClient);
    fileService = new FileService(app.cassandraClient);
    friendService = new FriendService(app.cassandraClient);
    next();
});
before(function (next) {
    userService.createUser("subscribeTest:ID1", "Test Subscribe User 1", "test1@subscribe.com", "Test File Avatar 1", function (error, result) {
        if (error) {
            userService.getUserByAuthId("subscribeTest:ID1", function (error, result) {
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
before(function (next) {
    userService.createUser("subscribeTest:ID2", "Test Subscribe User 2", "test2@subscribe.com", "Test File Avatar 1", function (error, result) {
        if (error) {
            userService.getUserByAuthId("subscribeTest:ID2", function (error, result) {
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
before(function (next) {
    before(function (done) {
        fileService.createNewVersion(userId1, "SUBSCRIBEText2", true, false, null, null, ['SUBSCRIBE-TEST'], "File SUBSCRIBE content", function (error, result) {
            if (error) console.error(error.message);
            fileId1 = result.id;
            done();
        });
    });
    next();
});
before(function (next) {
    before(function (done) {
        fileService.createNewVersion(userId1, "SUBSCRIBEText2", true, false, null, null, ['SUBSCRIBE-TEST'], "File SUBSCRIBE content", function (error, result) {
            if (error) console.error(error.message);
            fileId2 = result.id;
            done();
        });
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
    app.cassandraClient.execute(
        "insert into mindweb.sessions (sid,session) values (:sessionId,:session)",
        {sessionId: SESSION_ID, session: JSON.stringify({user: userId1})}, {}, next
    );
});
describe('WebSocket subscription tests', function () {

    it("Subscribes to a non-existing file", function (done) {
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
                assert.equal("ErrorResponse", response.name);
                assert.equal("error", response.result);
                assert.instanceOf(response, ErrorResponse);
                const errorResponse: ErrorResponse = response as ErrorResponse;
                assert.equal("TypeError", errorResponse.errorName);
                connection.close();
            });
            connection.send(JSON.stringify(new SubscribeRequest("INVALID")));
        });
        client.connect('ws://localhost:' + PORT + '?mindweb-session=' + SESSION_ID, "mindweb-protocol", "http://myorigin:8080");
    });
    it("Subscribes to an existing file", function (done) {
        this.timeout(12000);
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
                assert.instanceOf(response, TextResponse);
                const echoResponse: TextResponse = response as TextResponse;
                assert.equal("Subscription done", echoResponse.message);
                connection.close();
            });
            connection.send(JSON.stringify(new SubscribeRequest(fileId1)));
        });
        client.connect('ws://localhost:' + PORT + '?mindweb-session=' + SESSION_ID, "mindweb-protocol", "http://myorigin:8080");
    });
    it("Unsubscribes from a file", function (done) {
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
                assert.instanceOf(response, TextResponse);
                const echoResponse: TextResponse = response as TextResponse;
                assert.equal("Unsubscribe done", echoResponse.message);
                connection.close();
            });
            connection.send(JSON.stringify(new UnsubscribeRequest(fileId1)));
        });
        client.connect('ws://localhost:' + PORT + '?mindweb-session=' + SESSION_ID, "mindweb-protocol", "http://myorigin:8080");
    });
    it("Subscribes to an existing file and send updates", function (done) {
        this.timeout(12000);
        const client1: websocket.client = new websocket.client();
        let editConnection: websocket.connection;
        let receiveConnection: websocket.connection;
        client1.on('connectFailed', function (err) {
            assert.ok(false, 'Connection should not fail');
            done();
        });
        const client2: websocket.client = new websocket.client();
        client2.on('connectFailed', function (err) {
            assert.ok(false, 'Connection should not fail');
            done();
        });
        let messageCount = 0;
        client1.on('connect', function (connection: websocket.connection) {
            connection.on('error', function (error: Error) {
                assert.fail('got error' + error.message);
            });
            connection.on('close', function () {
                done();
            });
            connection.on('message', function (message: IMessage) {
                const response: AbstractResponse = ResponseFactory.create(message);

                if (messageCount++ > 3) {
                    editConnection.close();
                }
            });
            receiveConnection = connection;
            connection.send(JSON.stringify(new SubscribeRequest(fileId1)));
            client2.connect('ws://localhost:' + PORT + '?mindweb-session=' + SESSION_ID, "mindweb-protocol", "http://myorigin:8080");
        });
        client1.connect('ws://localhost:' + PORT + '?mindweb-session=' + SESSION_ID, "mindweb-protocol", "http://myorigin:8080");
        client2.on('connect', function (connection: websocket.connection) {
            connection.on('error', function (error: Error) {
                assert.fail('got error' + error.message);
            });
            connection.on('close', function () {
                receiveConnection.close();
            });
            connection.on('message', function (message: IMessage) {
                assert.isNotNull(message, "Message cannot be empty");
                assert.equal("utf8", message.type, "Message type must be utf8");
                assert.isNotNull(message.utf8Data, "Message body must exist");
                const response: AbstractResponse = ResponseFactory.create(message);
                assert.equal("TextResponse", response.name);
                assert.instanceOf(response, TextResponse);
                const echoResponse: TextResponse = response as TextResponse;
                assert.equal("Edit accepted", echoResponse.message);
            });
            connection.send(JSON.stringify(new SubscribeRequest(fileId1)));
            connection.send(JSON.stringify(new EditRequest(fileId1, new EditAction())));
            editConnection = connection;
        });
    });

});
after(function (next) {
    userService.deleteUser(userId1, function (error: ServiceError) {
        next();
    });
});
after(function (next) {
    userService.deleteUser(userId2, function (error: ServiceError) {
        next();
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