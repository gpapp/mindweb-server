/// <reference path="../typings/tsd.d.ts" />
import * as cassandra from 'cassandra-driver';

export default function (cassandraOptions, callback) {

    console.log("Creating keyspace");
    var cassandraClient = new cassandra.Client(cassandraOptions);
    cassandraClient.connect(function (error) {
        if(error) {
            throw error;
        }
        cassandraClient.execute("CREATE KEYSPACE IF NOT EXISTS mindweb WITH replication" +
            "={ 'class': 'SimpleStrategy', 'replication_factor': 1};",null,null,
            function(error,result){
                callback(error);
            });
    });
}