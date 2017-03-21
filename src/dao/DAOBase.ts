import * as cassandra from 'cassandra-driver';

export default  class DAOBase {
    private client;

    constructor(client) {
        this.client = client;
    }

    execute(query:string, params:Object, next:(error:Error,result:cassandra.types.ResultSet)=>void) {
        this.client.execute(query, params, {prepare: true}, next);
    }
}