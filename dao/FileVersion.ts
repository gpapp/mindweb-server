/// <reference path="../typings/tsd.d.ts" />
import DAOBase from './DAOBase';
import * as cassandra from 'cassandra-driver';

export default class FileVersion extends DAOBase {
    public createNewVersion(id:string|cassandra.types.Uuid, version:number, content:string, next:Function) {
        var query = 'INSERT INTO mindweb.fileVersion (id, version, created, modified, content) ' +
            'VALUES (:id,:version,dateOf(now()),dateOf(now()), textAsBlob(:content))';
        this.execute(query, {id: id, version: version, content: content}, next);
    }

    public updateVersion(id:string|cassandra.types.Uuid, content:string, next:Function) {
        var query = 'INSERT INTO mindweb.fileVersion (id, modified, content) ' +
            'VALUES (:id, dateOf( now() ), textAsBlob(:content))';
        this.execute(query, {id: id, content: content}, next);
    }

    public getContent(fileVersionId:string|cassandra.types.Uuid, next:Function) {
        var query = 'SELECT version,blobAsText(content) as content FROM mindweb.fileVersion WHERE id=:fileVersionId';
        this.execute(query, {fileVersionId: fileVersionId}, next);
    }

    public deleteById(fileId:string|cassandra.types.Uuid, next:Function) {
        var query = 'DELETE FROM mindweb.fileVersion WHERE id = :fileId';
        this.execute(query, {fileId: fileId}, next);
    }
}