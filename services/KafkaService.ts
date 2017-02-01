import * as cassandra from "cassandra-driver";
import * as kafka from "kafka-node";
import * as app from "../app";
import ServiceError from "../classes/ServiceError";
import EditAction from "../classes/EditAction";
import FileService from "./FileService";
import AbstractResponse from "../responses/AbstractResponse";
import JoinResponse from "../responses/JoinResponse";
import EditResponse from "../responses/EditResponse";
import PublishedResponse from "../responses/PublishedResponse";

export default class KafkaService {
    private fileService: FileService;
    private consumer: kafka.Consumer;
    private producer: kafka.Producer;
    private producerReady: boolean;

    constructor(cassandraClient: cassandra.Client, callback: (message: kafka.KeyedMessage) => void) {
        this.fileService = new FileService(cassandraClient);
        const consumerClient: kafka.Client = new kafka.Client(app.options['kafka']['connection'], 'consumer-' + cassandra.types.Uuid.random());
        const producerClient: kafka.Client = new kafka.Client(app.options['kafka']['connection'], 'producer-' + cassandra.types.Uuid.random());
        this.consumer = new kafka.Consumer(consumerClient, [], {});
        this.producer = new kafka.Producer(producerClient);
        this.consumer.on("message", callback);
    }

    private isProducerReady(next: (error: ServiceError) => void): void {
        const parent = this;
        if (this.producerReady) {
            next(null);
        } else {
            this.producer.on('ready', function () {
                parent.producerReady = true;
                next(null);
            });
            this.producer.on('error', function (error: Error) {
                next(new ServiceError(500, error.message, "Error in subscribeToFile"));
            });
        }
    }

    public subscribeToFile(sessionId: string, userId: string|cassandra.types.Uuid, fileId: string|cassandra.types.Uuid, callback: (error: ServiceError) => void) {
        const newTopic = 'editor-' + fileId.toString();
        const parent: KafkaService = this;
        this.isProducerReady(function (error: ServiceError) {
                const payload: AbstractResponse = new JoinResponse(userId);
                parent.publishResponse(sessionId, newTopic, payload,
                    function (error: Error) {
                        if (error) {
                            let message = "Error creating items:" + "" + newTopic + "\t" + error[0] + "\n";
                            callback(new ServiceError(500, message, "Error in subscription"));
                            return;
                        }
                        parent.consumer.addTopics([newTopic], function (error: ServiceError) {
                            if (error) {
                                callback(new ServiceError(500, error.message, "Error in subscription"));
                                return;
                            }
                            callback(null);
                        });
                    }
                )                ;
            }
        );
    }

    public    unsubscribeToFile(sessionId: string, fileId: string | cassandra.types.Uuid, callback: (error: ServiceError) => void) {
        const newTopics = ['editor-' + fileId.toString()];
        const parent: KafkaService = this;
        parent.consumer.removeTopics(newTopics, function (error: any, removed) {
            if (error) {
                callback(new ServiceError(500, error.message, "Error in fileId remove"));
                return;
            }
            callback(null);
        });
    }

    public    sendUpdateToFile(sessionId: string, fileId: string | cassandra.types.Uuid, action: EditAction, callback: (error: Error, result?: any) => void) {
        const parent: KafkaService = this;
        this.isProducerReady(function (error: ServiceError) {
            const payload: AbstractResponse = new EditResponse(action);
            parent.publishResponse(sessionId, "editor-" + fileId, payload, function (error: any, data: any) {
                if (error) {
                    callback(new ServiceError(500, error.message, "Error in sending update"));
                    return;
                }
                callback(null, data);
            });
        });
    }

    private publishResponse(sessionId: string, topic: string, payload: AbstractResponse, callback: (error: any, data: any) => void) {
        const response: PublishedResponse = new PublishedResponse(sessionId, payload);
        this.producer.send([{
                topic: topic,
                messages: JSON.stringify(response)
            }],
            callback
        );
    }
}

