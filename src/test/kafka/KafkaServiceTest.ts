/**
 * Created by gpapp on 2016.12.30..
 */
import * as app from "../../app";
import KafkaService from "../../services/KafkaService";
import {KeyedMessage} from "kafka-node";
import {ServiceError, AbstractMessage} from "mindweb-request-classes";
import {before, describe, it, after} from "mocha";
import {assert} from "chai";
import UserService from "../../services/UserService";
import FileService from "../../services/MapService";
import FriendService from "../../services/FriendService";
import PublishedResponseFactory from "../../responseImpl/PublishedResponseFactory";
import JoinResponse from "mindweb-request-classes/response/JoinResponse";
import PublishedResponse from "../../responseImpl/PublishedResponse";
import AbstractResponse from "mindweb-request-classes/response/AbstractResponse";
import MapVersion from "mindweb-request-classes/classes/MapVersion";

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
        const kafkaService = new KafkaService(app.cassandraClient, (message: KeyedMessage) => {
            let response: AbstractMessage = PublishedResponseFactory.create(message).message;
            assert.isTrue(response instanceof JoinResponse);
            const joinResponse = response as JoinResponse;
            assert.equal(userId1.toString(), joinResponse.userId);
            assert.equal(fileId1.toString(), joinResponse.fileId);
        });


        kafkaService.subscribeToFile(SESSION_ID1, userId1, fileId1, (error: ServiceError, version?: MapVersion) => {
            assert.isNull(error, error ? error.message : "WTF");
            assert.isNotNull(version, "No map returned");
            assert.equal(version.version, 1);
            kafkaService.closeAll(SESSION_ID1);
            done();
        }, (response: AbstractResponse) => {

        });
    });

    it("open two sessions", function (done) {
        this.timeout(10000);
        const kafkaService1 = new KafkaService(app.cassandraClient, (message: KeyedMessage) => {

            const publishedResponse: PublishedResponse = PublishedResponseFactory.create(message);
            if (SESSION_ID1 == publishedResponse.originSessionId) {
                let response: AbstractMessage = publishedResponse.message;
                assert.isTrue(response instanceof JoinResponse);
                const joinResponse = response as JoinResponse;
                assert.equal(userId1.toString(), joinResponse.userId);
                kafkaService1.subscribeToFile(SESSION_ID1, userId1, fileId1, (error: ServiceError, version?: MapVersion) => {
                    assert.isNull(error, error ? error.message : "WTF");
                    assert.isNotNull(version, "No map returned");
                    assert.equal(version.version, 1);
                }, (response: AbstractResponse) => {

                });
                const kafkaService2 = new KafkaService(app.cassandraClient, (message: KeyedMessage) => {
                    const publishedResponse = PublishedResponseFactory.create(message);
                    if (SESSION_ID2 == publishedResponse.originSessionId) {
                        let response: AbstractMessage = publishedResponse.message;
                        assert.isTrue(response instanceof JoinResponse);
                        const joinResponse = response as JoinResponse;
                        assert.equal(fileId1.toString(), joinResponse.fileId);
                        assert.equal(userId2.toString(), joinResponse.userId);

                    }
                });
                kafkaService2.subscribeToFile(SESSION_ID2, userId2, fileId1, (error: ServiceError, version?: MapVersion) => {
                    assert.isNull(error, error ? error.message : "WTF");
                    assert.isNotNull(version, "No map returned");
                    assert.equal(version.version, 1);
                    kafkaService1.closeAll(SESSION_ID1);
                    kafkaService2.closeAll(SESSION_ID2);
                    done();
                }, (response: AbstractResponse) => {

                });
            }
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