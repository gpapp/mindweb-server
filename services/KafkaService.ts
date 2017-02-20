import * as cassandra from "cassandra-driver";
import * as kafka from "kafka-node";
import * as app from "../app";
import ServiceError from "map-editor/dist/classes/ServiceError";
import EditAction from "map-editor/dist/classes/EditAction";
import FileService from "./FileService";
import AbstractResponse from "mindweb-request-classes/dist/response/AbstractResponse";
import JoinResponse from "mindweb-request-classes/dist/response/JoinResponse";
import EditResponse from "mindweb-request-classes/dist/response/EditResponse";
import PublishedResponse from "mindweb-request-classes/dist/response/PublishedResponse";
import ErrorResponse from "mindweb-request-classes/dist/response/ErrorResponse";
import File from "../classes/File";
import FileVersion from "../classes/FileVersion";
import FileContent from "map-editor/dist/classes/FileContent";
import mapeditor from "map-editor/dist/map-editor";
import {MindwebService} from "../../mindweb-request-classes/src/service/MindwebService";

class FileCacheItem {
    subscribers: number;
    content: FileContent;
}

/**
 * One instance per websocket connection
 */
export default class KafkaService implements MindwebService {
    private static cache: Map<string,FileCacheItem> = new Map();

    private openfiles: Set<string> = new Set();
    private fileService: FileService;
    private consumer: kafka.Consumer;
    private producerPromise: Promise<ServiceError|kafka.Producer>;


    constructor(cassandraClient: cassandra.Client, clientCallback: (message: kafka.KeyedMessage) => void) {
        this.fileService = new FileService(cassandraClient);
        const consumerClient: kafka.Client = new kafka.Client(app.options['kafka']['connection'], 'consumer-' + cassandra.types.Uuid.random());
        this.consumer = new kafka.Consumer(consumerClient, [], {});
        this.consumer.on("message", clientCallback);

        const producerClient: kafka.Client = new kafka.Client(app.options['kafka']['connection'], 'producer-' + cassandra.types.Uuid.random());
        const producer = new kafka.Producer(producerClient);
        this.producerPromise = new Promise((resolve, reject) => {
            producer.on('ready', function () {
                resolve(producer);
            });
            producer.on('error', function (error: Error) {
                reject(new ServiceError(500, error.message, "Error in subscribeToFile"));
            });
        });
    }

    private static openFile(fileService: FileService, fileId: string|cassandra.types.Uuid, done: (error?: ServiceError) => void): void {
        const cacheItem: FileCacheItem = KafkaService.cache[fileId.toString()];
        if (cacheItem) {
            cacheItem.subscribers++;
            done(null);
            return;
        }
        fileService.getFile(fileId, function (error: ServiceError, result?: File): void {
            if (error) {
                done(error);
                return;
            }
            fileService.getFileVersion(result.versions[0], function (error: ServiceError, file?: FileVersion): void {
                if (error) {
                    done(error);
                    return;
                }
                KafkaService.cache[fileId.toString()] = {subscribers: 1, content: file.content};
                done();
            })
        });
    }

    private static updateFile(fileId: string|cassandra.types.Uuid, action: EditAction, done: (error?: ServiceError) => void): void {
        const cacheItem: FileCacheItem = KafkaService.cache[fileId.toString()];
        if (!cacheItem) {
            //TODO handle error
                done(null);
            return;
        }
        mapeditor.applyAction(cacheItem.content, action, function (error: ServiceError): void {
                if (error) {
                    done(error);
                    return;
                }
                done();
        });
    }

    private static closeFile(fileService: FileService, fileId: string|cassandra.types.Uuid, done: (error?: ServiceError) => void): void {
        const cacheItem: FileCacheItem = KafkaService.cache[fileId.toString()];
        if (!cacheItem) {
            //TODO handle error
            done();
            return;
        }
        if (--cacheItem.subscribers) {
            done();
            return;
        }
        fileService.updateFileVersion(fileId, cacheItem.content.toString(), function (error: ServiceError, result?: string): void {
                if (error) {
                    done(error);
                    return;
                }
                delete KafkaService.cache[fileId.toString()];
                done();
        });
    }


    public subscribeToFile(sessionId: string, userId: string|cassandra.types.Uuid, fileId: string|cassandra.types.Uuid, callback: (error: ServiceError) => void) {
        const newTopic = fileId.toString();
        const payload: AbstractResponse = new JoinResponse(userId);
        const parent = this;
        this.publishResponse(sessionId, newTopic, payload,
            function (error: Error) {
                if (error) {
                    callback(new ServiceError(500,
                        "Error creating items:" + "" + newTopic + "\t" + error[0] + "\n",
                        "Error in subscription"));
                    return;
                }
                parent.consumer.addTopics([newTopic], function (error: ServiceError) {
                    if (error) {
                        callback(new ServiceError(500, error.message, "Error in subscription"));
                        return;
                    }
                });
                parent.openfiles.add(fileId.toString());
                KafkaService.openFile(parent.fileService, fileId, callback);
            }
        );
    }

    public    unsubscribeToFile(sessionId: string, fileId: string | cassandra.types.Uuid, callback: (error: ServiceError) => void) {
        const newTopics = [fileId.toString()];
        const parent = this;
        this.consumer.removeTopics(newTopics, function (error: any, removed) {
            if (error) {
                callback(new ServiceError(500, error.message, "Error in fileId remove"));
                return;
            }
            KafkaService.closeFile(parent.fileService, fileId, callback);
        });
    }

    public    sendUpdateToFile(sessionId: string, fileId: string | cassandra.types.Uuid, action: EditAction, callback: (error: Error, result?: any) => void) {
        const parent: KafkaService = this;
        const payload: AbstractResponse = new EditResponse(action);
        parent.publishResponse(sessionId, fileId.toString(), payload, function (error: any, data: any) {
            if (error) {
                callback(new ServiceError(500, error.message, "Error in sending update"));
                return;
            }
            callback(null, data);
        });
    }

    private publishResponse(sessionId: string, topic: string, payload: AbstractResponse, callback: (error: any, data: any) => void) {
        const response: PublishedResponse = new PublishedResponse(sessionId, payload);
        this.producerPromise.then((producer: kafka.Producer) => {
            producer.createTopics([topic], true, (error, data) => {
                producer.send([{
                        topic: topic,
                        messages: JSON.stringify(response)
                    }],
                    callback
                );
            });

        });
        this.producerPromise.catch((error: ServiceError) => {
            callback(error, null);
        })
    }

    public closeAll(sessionId: string) {
        this.consumer.close(false, function () {

        });
    }
}

