/// <reference path="../typings/tsd.d.ts" />
import * as cassandra from 'cassandra-driver';

export default class User {
    public authId:string;
    public  name:string;
    public  email:string;
    public  avatarUrl:string;
    public  created:string;
    public  modified:string;

    constructor(authId:string,
                name:string,
                email:string,
                avatarUrl:string,
                created:string,
                modified:string) {
        this.authId = authId;
        this.name = name;
        this.email = email;
        this.avatarUrl = avatarUrl;
        this.created = created;
        this.modified = modified;
    }
}