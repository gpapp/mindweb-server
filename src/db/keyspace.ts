import * as cassandra from 'cassandra-driver';

export default (cassandraClient, callback) => {
    console.log("Creating keyspace");
    cassandraClient.connect((error) => {
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