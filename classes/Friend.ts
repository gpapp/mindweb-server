import * as cassandra from 'cassandra-driver';

export default class Friend {
    public id:string|cassandra.types.Uuid;
    public owner:string|cassandra.types.Uuid;
    public alias:string;
    public linkedUser:string|cassandra.types.Uuid;
    public tags:string[];
    public created:string;
    public modified:string;

    constructor(id:string|cassandra.types.Uuid,
                owner:string|cassandra.types.Uuid,
                alias:string,
                linkedUser:string|cassandra.types.Uuid,
                tags:string[],
                created:string,
                modified:string) {
        this.id = id;
        this.owner = owner;
        this.alias = alias;
        this.linkedUser = linkedUser;
        this.tags = tags;
        this.created = created;
        this.modified = modified;
    }
}