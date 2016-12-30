import * as cassandra from 'cassandra-driver';

export default class User {
    public id:string|cassandra.types.Uuid;
    public  persona:string[];
    public  name:string;
    public  email:string;
    public  avatarUrl:string;
    public  created:string;
    public  modified:string;

    constructor(id:string|cassandra.types.Uuid,
                persona:string[],
                name:string,
                email:string,
                avatarUrl:string,
                created:string,
                modified:string) {
        this.id = id;
        this.persona = persona;
        this.name = name;
        this.email = email;
        this.avatarUrl = avatarUrl;
        this.created = created;
        this.modified = modified;
    }
}