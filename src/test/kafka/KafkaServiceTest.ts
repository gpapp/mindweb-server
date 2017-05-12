/**
 * Created by gpapp on 2016.12.30..
 */
import * as app from "../../app";
import KafkaService from "../../services/KafkaService";
import {KeyedMessage} from "kafka-node";
import {ServiceError, AbstractMessage} from "mindweb-request-classes";
import {assert} from "chai";
import UserService from "../../services/UserService";
import FileService from "../../services/MapService";
import FriendService from "../../services/FriendService";
import PublishedResponseFactory from "../../responseImpl/PublishedResponseFactory";
import JoinResponse from "mindweb-request-classes/response/JoinResponse";
import PublishedResponse from "../../responseImpl/PublishedResponse";

const SESSION_ID1 = "SESSION-TEST-1234567890-1";
const SESSION_ID2 = "SESSION-TEST-1234567890-2";
const SESSION_ID3 = "SESSION-TEST-1234567890-3";
const FILE_CONTENT = {'$': '', 'rootNode': 'MapContainer SUBSCRIBE content'};

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
    userService.createUser("kafkaTest:ID1", "Test Subscribe User 1", "test1@kafka.com", "Test MapContainer Avatar 1", (error, result) => {
        if (error) {
            userService.getUserByAuthId("kafkaTest:ID1", (error, result) => {
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
    userService.createUser("kafkaTest:ID2", "Test Subscribe User 2", "test2@kafka.com", "Test MapContainer Avatar 1", (error, result) => {
        if (error) {
            userService.getUserByAuthId("kafkaTest:ID2", (error, result) => {
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
        fileService.createNewVersion(userId1, "KAFKAText1", true, false, null, null, ['KAFKA-TEST'], JSON.stringify(FILE_CONTENT), (error, result) => {
            if (error) console.error(error.message);
            fileId1 = result.id.toString();
            done();
        });
    });
    next();
});
before((next) => {
    before((done) => {
        fileService.createNewVersion(userId1, "KAFKAText2", true, false, null, null, ['KAFKA-TEST'], JSON.stringify(FILE_CONTENT), (error, result) => {
            if (error) console.error(error.message);
            fileId2 = result.id.toString();
            done();
        });
    });
    next();
});


before((next) => {
    app.cassandraClient.execute(
        "insert into mindweb.sessions (sid,session) values (:sessionId,:session)",
        {sessionId: SESSION_ID1, session: JSON.stringify({user: "Pumukli"})}, {}, next
    );
});
before((next) => {
    app.cassandraClient.execute(
        "insert into mindweb.sessions (sid,session) values (:sessionId,:session)",
        {sessionId: SESSION_ID2, session: JSON.stringify({user: "Pumukli"})}, {}, next
    );
});
before((next) => {
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

describe('Kafka connection tests', () => {

    it("open kafka call", function (done) {
        this.timeout(10000);
        let gotMsg: boolean = false;
        let gotResp: boolean = false;
        const kafkaService = new KafkaService(app.cassandraClient, (message: KeyedMessage) => {
            let response: AbstractMessage = PublishedResponseFactory.create(message).message;
            assert.isTrue(response instanceof JoinResponse);
            const joinResponse = response as JoinResponse;
            assert.equal(userId1.toString(), joinResponse.userId);
            assert.equal(fileId1.toString(), joinResponse.fileId);
            gotMsg = true;
        });


        kafkaService.subscribeToFile(SESSION_ID1, userId1, fileId1, (error: ServiceError) => {
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
        this.timeout(10000);
        let gotMsg1: number = 0;
        let gotResp1: number = 0;
        const kafkaService1 = new KafkaService(app.cassandraClient, (message: KeyedMessage) => {

            const publishedResponse: PublishedResponse = PublishedResponseFactory.create(message);
            if (SESSION_ID1 == publishedResponse.originSessionId) {
                let response: AbstractMessage = publishedResponse.message;
                assert.isTrue(response instanceof JoinResponse);
                const joinResponse = response as JoinResponse;
                assert.equal(userId1.toString(), joinResponse.userId);
                gotMsg1++;
            }
        });
        const messageTegst = getPromiseFor(() => {
            return gotMsg1 == 1;
        });
        const subscribeTest = getPromiseFor(() => {
            return gotResp1 == 1;
        });
        kafkaService1.subscribeToFile(SESSION_ID1, userId1, fileId1, (error: ServiceError) => {
            assert.isNull(error, error ? error.message : "WTF");
            gotResp1 = 1;
        });
        Promise.all([messageTest, subscribeTest]).then(() => {
            let gotMsg2: number = 0;
            let gotResp2: number = 0;

            const kafkaService2 = new KafkaService(app.cassandraClient, (message: KeyedMessage) => {
                const publishedResponse = PublishedResponseFactory.create(message);
                if (SESSION_ID2 == publishedResponse.originSessionId) {
                    let response: AbstractMessage = publishedResponse.message;
                    assert.isTrue(response instanceof JoinResponse);
                    const joinResponse = response as JoinResponse;
                    assert.equal(fileId1.toString(), joinResponse.fileId);
                    assert.equal(userId2.toString(), joinResponse.userId);
                    gotMsg2++;
                }
            });
            kafkaService2.subscribeToFile(SESSION_ID2, userId2, fileId1, (error: ServiceError) => {
                assert.isNull(error, error ? error.message : "WTF");
                gotResp2 = 1;
            });
            const messageTest1 = getPromiseFor(() => {
                return gotMsg1 >= 1
            });
            const messageTest2 = getPromiseFor(() => {
                return gotMsg2 >= 1
            });
            const subscribeTest = getPromiseFor(() => {
                return gotResp2 >= 1
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