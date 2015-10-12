/// <reference path="../typings/tsd.d.ts" />
import * as cassandra from 'cassandra-driver';

export default class User {
    public id:string|cassandra.types.Uuid;
    public owner:string|cassandra.types.Uuid;
    public alias:string;
    public linkedUser:string|cassandra.types.Uuid;
    public created:string;
    public modified:string;

    constructor(id:string|cassandra.types.Uuid,
                owner:string|cassandra.types.Uuid,
                alias:string,
                linkedUser:string|cassandra.types.Uuid,
                created:string,
                modified:string) {
        this.id = id;
        this.owner = owner;
        this.alias = alias;
        this.linkedUser = linkedUser;
        this.created = created;
        this.modified = modified;
    }
}