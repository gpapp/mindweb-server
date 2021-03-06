import {ServiceError} from "mindweb-request-classes";
import * as cassandra from 'cassandra-driver';
import * as async from 'async';

var client:cassandra.Client;
export default function patch(cassandraClient:cassandra.Client,
                              afterExecution:(error:ServiceError, pass:string, callback:(error?:ServiceError)=>void)=>void,
                              callback:(error?:ServiceError)=>void) {
    client = cassandraClient;
    async.parallel([
        addColumn,
        updateValues
    ], (error:ServiceError) => {
        afterExecution(error, 'Adding shareable column to file database', callback)
    });
}

function addColumn(next) {
    client.execute(
        'ALTER TABLE mindweb.file ADD shareable boolean;',
        (err, res) => {
            client.execute('CREATE INDEX IF NOT EXISTS file_shareable ON mindweb.file (shareable);', next);
        });
}

function updateValues(next) {
    client.execute(
        'SELECT id FROM mindweb.file;',
        (err, res) => {
            if (res) {
                async.each(res.rows,
                        (row, nextI) => {
                            client.execute('UPDATE mindweb.file SET shareable=true WHERE id=:id;',
                	    {id: row['id']},
                    	    {prepare: true},
                    	    nextI);
            		}
            		, next
        	    );
            } else {
        	next();
    	    }
        });
}
