/// <reference path="../typings/tsd.d.ts" />
import File from "./File";
import * as cassandra from 'cassandra-driver';

export default class FileVersion {
    version:number;
    content:string;
    file:File;

    constructor(version:number, content:string) {
        this.version = version;
        this.content = content;
    }
}