var async = require('async'),
    cassandra = require('cassandra-driver');

module.exports = function (cassandraOptions) {

    console.log("Creating keyspace");
    var cassandraClient = new cassandra.Client(cassandraOptions);
    cassandraClient.connect(function (error, ok) {
        cassandraClient.execute("CREATE KEYSPACE IF NOT EXISTS mindweb WITH replication" +
            "={ 'class': 'SimpleStrategy', 'replication_factor': 1};",
            function () {
            });
    });
}