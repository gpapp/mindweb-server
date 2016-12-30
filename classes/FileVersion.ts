import File from "./File";
import * as cassandra from 'cassandra-driver';
import FileContent from "./FileContent";

export default class FileVersion {
    version:number;
    content:FileContent;
    file:File;

    constructor(version:number, content:FileContent) {
        this.version = version;
        this.content = content;
    }
}