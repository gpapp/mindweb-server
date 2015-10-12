declare module "cassandra-driver" {

    export module types {
        export interface Uuid {
            random():Uuid;
            fromString(String):Uuid;
        }
    }

    export module client {
        export class Options {
            contactPoints:string[];
            protocolOptions:{
                port:number;
            };
            authProvider:{
                username:string;
                password:string;
            }
            keyspace:string;
        }
    }

    export class Client {
        constructor(options);

        connect(callback:Function);

        execute(query:string, callback:Function);
        execute(query:string, options:any, callback:Function);
        execute(query:string, params:any, options:any, callback:Function);
    }
}