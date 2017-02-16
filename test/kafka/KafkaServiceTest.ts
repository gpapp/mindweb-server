/**
 * Created by gpapp on 2016.12.30..
 */
import * as app from "../../app";
import KafkaService from "../../services/KafkaService";
import * as kafka from "kafka-node";
import {KeyedMessage} from "kafka-node";
import ServiceError from "map-editor/dist/classes/ServiceError";
import {assert} from "chai";
import ResponseFactory from "../../responses/ResponseFactory";
import AbstractResponse from "../../responses/AbstractResponse";
import JoinResponse from "../../responses/JoinResponse";
import PublishedResponse from "../../responses/PublishedResponse";
import UserService from "../../services/UserService";
import FileService from "../../services/FileService";
import FriendService from "../../services/FriendService";

const SESSION_ID1 = "SESSION-TEST-1234567890-1";
const SESSION_ID2 = "SESSION-TEST-1234567890-2";
const SESSION_ID3 = "SESSION-TEST-1234567890-3";
const FILE_CONTENT = {'$': '', 'rootNode': 'File SUBSCRIBE content'};

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
    userService.createUser("kafkaTest:ID1", "Test Subscribe User 1", "test1@kafka.com", "Test File Avatar 1", function (error, result) {
        if (error) {
            userService.getUserByAuthId("kafkaTest:ID1", function (error, result) {
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
    userService.createUser("kafkaTest:ID2", "Test Subscribe User 2", "test2@kafka.com", "Test File Avatar 1", function (error, result) {
        if (error) {
            userService.getUserByAuthId("kafkaTest:ID2", function (error, result) {
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
        fileService.createNewVersion(userId1, "KAFKAText1", true, false, null, null, ['KAFKA-TEST'], JSON.stringify(FILE_CONTENT), function (error, result) {
            if (error) console.error(error.message);
            fileId1 = result.id;
            done();
        });
    });
    next();
});
before(function (next) {
    before(function (done) {
        fileService.createNewVersion(userId1, "KAFKAText2", true, false, null, null, ['KAFKA-TEST'], JSON.stringify(FILE_CONTENT), function (error, result) {
            if (error) console.error(error.message);
            fileId2 = result.id;
            done();
        });
    });
    next();
});


before(function (next) {
    app.cassandraClient.execute(
        "insert into mindweb.sessions (sid,session) values (:sessionId,:session)",
        {sessionId: SESSION_ID1, session: JSON.stringify({user: "Pumukli"})}, {}, next
    );
});
before(function (next) {
    app.cassandraClient.execute(
        "insert into mindweb.sessions (sid,session) values (:sessionId,:session)",
        {sessionId: SESSION_ID2, session: JSON.stringify({user: "Pumukli"})}, {}, next
    );
});
before(function (next) {
    app.cassandraClient.execute(
        "insert into mindweb.sessions (sid,session) values (:sessionId,:session)",
        {sessionId: SESSION_ID3, session: JSON.stringify({user: "Pumukli"})}, {}, next
    );
});
function getPromiseFor(fn: () => boolean) {
    return new Promise((resolve) => {
        function waitfor() {
            setTimeout(() => {
                if (fn()) {
                    resolve();
                } else
                    waitfor();
            }, 100);
        }

        waitfor();
    });
}

describe('Kafka connection tests', function () {

    it("open kafka call", function (done) {
        let gotMsg: boolean = false;
        let gotResp: boolean = false;
        const kafkaService = new KafkaService(app.cassandraClient, function (message: KeyedMessage) {
            let response: AbstractResponse = PublishedResponse.create(message).response;
            assert.equal('JoinResponse', response.name);
            assert.equal(fileId1.toString(), response.fileId);
            assert.isTrue(response instanceof JoinResponse);
            const joinResponse = response as JoinResponse;
            assert.equal(userId1.toString(), joinResponse.userId);
            gotMsg = true;
        });


        kafkaService.subscribeToFile(SESSION_ID1, userId1, fileId1, function (error: ServiceError) {
            assert.isNull(error, error ? error.message : "WTF");
            gotResp = true;
        });
        const messageTest = getPromiseFor(() => {
            return gotMsg
        });
        const subscribeTest = getPromiseFor(() => {
            return gotResp
        });
        Promise.all([messageTest, subscribeTest]).then(() => {
            kafkaService.closeAll(SESSION_ID1);
            done();
        });

    });

    it("open two sessions", function (done) {
        let gotMsg1: number = 0;
        let gotResp1: number = 0;
        const kafkaService1 = new KafkaService(app.cassandraClient, function (message: KeyedMessage) {

            const publishedResponse: PublishedResponse = PublishedResponse.create(message);
            if (SESSION_ID1 == publishedResponse.originSessionId) {
                let response: AbstractResponse = publishedResponse.response;
                assert.equal('JoinResponse', response.name);
                assert.equal(fileId1.toString(), response.fileId);
                assert.isTrue(response instanceof JoinResponse);
                const joinResponse = response as JoinResponse;
                assert.equal(userId1.toString(), joinResponse.userId);
                gotMsg1 ++;
            }
        });
        const messageTest = getPromiseFor(() => {
            return gotMsg1==1;
        });
        const subscribeTest = getPromiseFor(() => {
            return gotResp1==1;
        });
        kafkaService1.subscribeToFile(SESSION_ID1, userId1, fileId1, function (error: ServiceError) {
            assert.isNull(error, error ? error.message : "WTF");
            gotResp1 = 1;
        });
        Promise.all([messageTest, subscribeTest]).then(() => {
            let gotMsg2: number = 0;
            let gotResp2: number = 0;

            const kafkaService2 = new KafkaService(app.cassandraClient, function (message: KeyedMessage) {
                const publishedResponse = PublishedResponse.create(message);
                if (SESSION_ID2 == publishedResponse.originSessionId) {
                    let response: AbstractResponse = publishedResponse.response;
                    assert.equal('JoinResponse', response.name);
                    assert.equal(fileId1.toString(), response.fileId);
                    assert.isTrue(response instanceof JoinResponse);
                    const joinResponse = response as JoinResponse;
                    assert.equal(userId2.toString(), joinResponse.userId);
                    gotMsg2++;
                }
            });
            kafkaService2.subscribeToFile(SESSION_ID2, userId2, fileId1, function (error: ServiceError) {
                assert.isNull(error, error ? error.message : "WTF");
                gotResp2 = 1;
            });
            const messageTest1 = getPromiseFor(() => {
                return gotMsg1>=1
            });
            const messageTest2 = getPromiseFor(() => {
                return gotMsg2>=1
            });
            const subscribeTest = getPromiseFor(() => {
                return gotResp2>=1
            });
            Promise.all([messageTest1, messageTest2, subscribeTest]).then(() => {
                kafkaService1.closeAll(SESSION_ID1);
                kafkaService2.closeAll(SESSION_ID2);
                done();
            });
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
    app.cassandraClient.execute(
        "delete from mindweb.sessions where sid=:sessionId",
        {sessionId: SESSION_ID1}, {}, next
    );
});
after(function (next) {
    app.cassandraClient.execute(
        "delete from mindweb.sessions where sid=:sessionId",
        {sessionId: SESSION_ID2}, {}, next
    );
});
after(function (next) {
    app.cassandraClient.execute(
        "delete from mindweb.sessions where sid=:sessionId",
        {sessionId: SESSION_ID3}, {}, next
    );
});