import * as cassandra from 'cassandra-driver';

export default  class DAOBase {
    private client;

    constructor(client) {
        this.client = client;
    }

    execute(query, params, next) {
        this.client.execute(query, params, {prepare: true}, next);
    }
}