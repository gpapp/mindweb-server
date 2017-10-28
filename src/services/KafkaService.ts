import * as cassandra from "cassandra-driver";
import * as app from "../app";
import FileService from "./MapService";
import {AbstractResponse, EditAction, MapContainer, MapVersion, ServiceError} from "mindweb-request-classes";
import {MindwebService} from "mindweb-request-classes/service/MindwebService";
import MapService from "mindweb-request-classes/service/MapService";
import JoinResponse from "mindweb-request-classes/response/JoinResponse";
import EditResponse from "mindweb-request-classes/response/EditResponse";
import PublishedResponse from "../responseImpl/PublishedResponse";
import {Client, Consumer, KeyedMessage, Producer} from "kafka-node";
import {error} from "util";
import PublishedResponseFactory from "../responseImpl/PublishedResponseFactory";
import {AbstractMessage} from "mindweb-request-classes/classes/AbstractMessage";
import {BehaviorSubject} from "rxjs/BehaviorSubject";
import {Subscription} from "rxjs/Subscription";

class FileCacheItem {
    subscribers: number;
    offset: number;
    version: MapVersion;
    modified: boolean;
    subject: BehaviorSubject<EditedFileCacheItem>;
}

class EditedFileCacheItem {
    response: AbstractMessage;
    result: MapVersion;
}

/**
 * Utility class to manage cache items, subscribe to updates and execute them on cache items.
 *
 * Cache must be maintained over all servers, so if a new server node is attached the cache items
 * must be loaded locally
 */
class CacheExecutor {
    private consumer: Consumer;
    private cachePproducerPromise: Promise<ServiceError | Producer>;
    private objectCache: Map<string, FileCacheItem> = new Map();

    // TODO: Use timer to flush map to DB, and add internal only KAFKA message to mark last sync

    constructor(private fileService: FileService) {
        const consumerClient: Client = new Client(app.options['kafka']['connection'], 'consumer-' + cassandra.types.Uuid.random());
        this.consumer = new Consumer(consumerClient, [], {fromOffset: false});
        this.consumer.on('error', (error) => {
            console.log(`Error in kafka consumer: $error`)
        });
        // receive edit messages from all nodes
        this.consumer.on('message', (message: KeyedMessage) => {
                const publishedResponse: PublishedResponse = PublishedResponseFactory.create(message);
                const response: AbstractMessage = publishedResponse.message;
                this.getCacheItem(response.fileId, (error: ServiceError, cacheItem: FileCacheItem) => {
                    if (!cacheItem) {
                        return console.error(error);
                    }
                    if (response instanceof EditResponse) {
                        const editResponse: EditResponse = response as EditResponse;

                        if (!cacheItem.version.container.canEdit(editResponse.editor)) {
                            return console.error(new ServiceError(301, "This user is not permitted to edit this map", "Permission denied"));
                        }

                        MapService.applyAction(cacheItem.version.content, editResponse.action, (error: ServiceError) => {
                                if (error) {
                                    return console.error("Error sending update:" + error);
                                }
                                cacheItem.modified = true;
                                if (message['highWaterOffset'] - 1 == message['offset']) {
                                    cacheItem.subject.next({response: editResponse, result: cacheItem.version});
                                }
                            }
                        );
                    } else {
                        // Non-edit messages are for information only and can be published straight away
                        cacheItem.subject.next({response: response, result: cacheItem.version});
                    }
                });
            }
        );
    }

    getCacheItem(fileId: string, done: (error: ServiceError, item?: FileCacheItem) => void): void {
        const cacheItem: FileCacheItem = this.objectCache[fileId];
        if (cacheItem) {
            return done(null, cacheItem);
        }
        this.fileService.getMap(fileId, (error: ServiceError, mapContainer?: MapContainer) => {
            if (error) {
                done(error);
                return;
            }
            this.fileService.getMapVersion(mapContainer.versions[0], (error: ServiceError, version?: MapVersion) => {
                if (error) {
                    done(error);
                    return;
                }
                version.container = mapContainer;
                const newItem: FileCacheItem = {
                    subscribers: 0,
                    offset: 0,
                    version: version,
                    modified: false,
                    subject: new BehaviorSubject(null)
                };
                this.objectCache[fileId] = newItem;
                done(null, newItem);

                this.consumer.addTopics([{
                    topic: fileId,
                    offset: 0
                }], (error: ServiceError, added) => {
                    if (error) {
                        done(new ServiceError(500, error.message, "Error in subscription"));
                        return;
                    }
                }, true);
            })
        });
    }

    removeCacheItem(fileId: string, done: (error?: ServiceError) => void) {
        const cacheItem: FileCacheItem = this.objectCache[fileId];
        if (cacheItem.subject.observers.length > 0) {
            return done(null);
        }

        this.consumer.removeTopics([fileId], (error: any, removed) => {
            if (error) {
                return done(new ServiceError(500, error.message, "Error in fileId remove"));
            }

            delete this.objectCache[fileId];
            if (cacheItem.modified) {
                // force update of the file
                // Ebből még baj lesz multi-server környezetben!
                this.fileService.updateMapVersion(fileId, JSON.stringify(cacheItem.version.content),
                    (error: ServiceError, result?: string) => {
                        if (error) {
                            return done(error);
                        }
                        done();
                    });
            } else {
                done();
            }
        });
    }
}

/**
 * One instance per websocket connection
 */
export default class KafkaService implements MindwebService {
    private fileService: FileService;
    private cacheExecutor: CacheExecutor;
    private subscriptionCache: Map<string, Map<string, Subscription>>;
    private producerPromise: Promise<ServiceError | Producer>;

    constructor(cassandraClient: cassandra.Client, clientCallback: (message: KeyedMessage) => void) {
        this.fileService = new FileService(cassandraClient);
        this.cacheExecutor = new CacheExecutor(this.fileService);

        this.subscriptionCache = new Map();
        const producerClient: Client = new Client(app.options['kafka']['connection'], 'producer-' + cassandra.types.Uuid.random());
        const producer = new Producer(producerClient);
        this.producerPromise = new Promise((resolve, reject) => {
            producer.on('ready', () => {
                resolve(producer);
            });
            producer.on('error', (error: Error) => {
                reject(new ServiceError(500, error.message, "Error in subscribeToFile"));
            });
        });
    }

    public subscribeToFile(sessionId: string, userId: string, fileId: string,
                           callback: (error: ServiceError, version?: MapVersion) => void,
                           broadcast: (response: AbstractResponse) => void) {
        this.cacheExecutor.getCacheItem(fileId, (error: ServiceError, item: FileCacheItem) => {
            if (error) {
                return callback(error);
            }
            // publish new Join message
            const payload: AbstractResponse = new JoinResponse(fileId, userId);
            this.publishResponse(sessionId, fileId, payload,
                (error: Error) => {
                    if (error) {
                        callback(new ServiceError(500,
                            "Error creating items:" + "" + fileId + "\t" + error[0] + "\n",
                            "Error in subscription"));
                        return;
                    }
                }
            );
            // subscribe to changes
            const subscription: Subscription =
                item.subject.subscribe((item: EditedFileCacheItem) => {
                    if (!item) {
                        return;
                    }
                    if (item.response instanceof JoinResponse) {
                        callback(null, item.result);
                    } else {
                        broadcast(item.response as AbstractResponse);
                    }
                });
            if (!this.subscriptionCache.has(sessionId)) {
                this.subscriptionCache.set(sessionId, new Map());
            }
            const subcacheItem = this.subscriptionCache.get(sessionId);
            subcacheItem.set(fileId, subscription);
        });

    }

    public unsubscribeToFile(sessionId: string, fileId: string, callback: (error: ServiceError) => void) {
        this.cacheExecutor.getCacheItem(fileId, (error: ServiceError, item: FileCacheItem) => {
            if (!this.subscriptionCache.has(sessionId)) {
                return callback(new ServiceError(500,
                    "Error removing subscription. Session not in cache:" + sessionId,
                    "Error in unsubscription"));
            }
            const subcacheItem = this.subscriptionCache.get(sessionId);
            if (!subcacheItem.has(fileId)) {
                return callback(new ServiceError(500,
                    "Error removing subscription. Item not in cache:" + fileId,
                    "Error in unsubscription"));
            }
            const subscription = subcacheItem.get(fileId);
            subscription.unsubscribe();
            subcacheItem.delete(fileId);
            if (subcacheItem.size == 0) {
                this.subscriptionCache.delete(sessionId);
            }
            if (subscription.closed) {
                this.cacheExecutor.removeCacheItem(fileId, (error: ServiceError) => {
                    callback(error);
                });
            }
        });
    }

    public sendUpdateToFile(sessionId: string, userId: string, fileId: string, action: EditAction, callback: (error: Error, result?: any) => void) {
        const payload: AbstractResponse = new EditResponse(fileId, userId, action);
        this.publishResponse(sessionId, fileId, payload, (error: any, data: any) => {
            if (error) {
                callback(new ServiceError(500, error.message, "Error in sending update"));
                return;
            }
            callback(null, data);
        });

    }

    /**
     * Send a message directly to Kafka
     *
     * @param sessionId
     * @param topic
     * @param payload
     * @param callback
     */

    private publishResponse(sessionId: string, topic: string, payload: AbstractResponse, callback: (error: any, data: any) => void) {
        const response: PublishedResponse = new PublishedResponse(sessionId, payload);
        this.producerPromise.then((producer: Producer) => {
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

    /**
     * terminate all subscriprions related to a given session.
     *
     * @param sessionId
     */
    public closeAll(sessionId: string) {
        const sessionSubscriptions = this.subscriptionCache.get(sessionId);
        if (sessionSubscriptions) {
            for (let item of sessionSubscriptions.values()) {
                item.unsubscribe();
            }
        }
    }
}

