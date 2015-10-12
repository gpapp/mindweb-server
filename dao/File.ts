/// <reference path="../typings/tsd.d.ts" />
import DAOBase from './DAOBase';
import * as cassandra from 'cassandra-driver';

export default class File extends DAOBase {
    public getFiles(userId:string|cassandra.types.Uuid, next:Function) {
        var query = 'SELECT id, name, owner, versions, public, viewers, editors, created, modified ' +
            'FROM mindweb.file WHERE owner=:userId ALLOW FILTERING';
        this.execute(query, {userId: userId}, next);
    }

    public getFile(fileId:string|cassandra.types.Uuid, next:Function) {
        var query = 'SELECT id, name, owner, public, viewers, editors, versions FROM mindweb.file WHERE id=:fileId';
        this.execute(query, {fileId: fileId}, next);
    }

    public createFile(fileId:string|cassandra.types.Uuid, fileName:string, userId:string|cassandra.types.Uuid, versions:string[]|cassandra.types.Uuid[], next:Function) {
        var query = 'INSERT INTO mindweb.file (id, name, owner, versions, created, modified)' +
            'VALUES (:fileId,:fileName,:userId,:versions,dateOf(now()),dateOf(now()))';
        this.execute(query, {fileId: fileId, fileName: fileName, userId: userId, versions: versions}, next);
    }

    public updateFile(fileId:string|cassandra.types.Uuid, fileName:string, userId:string|cassandra.types.Uuid, versions:string[]|cassandra.types.Uuid[], next:Function) {
        var query = 'INSERT INTO mindweb.file (id, name, owner, versions, modified)' +
            'VALUES (:fileId,:fileName,:userId,:versions,dateOf(now()))';
        this.execute(query, {fileId: fileId, fileName: fileName, userId: userId, versions: versions}, next);
    }

    public getFileByUserAndName(userId:string|cassandra.types.Uuid, fileName:string, next:Function) {
        var query = 'SELECT id,versions FROM mindweb.file WHERE owner=:userId AND name=:fileName ALLOW FILTERING';
        this.execute(query, {userId: userId, fileName: fileName}, next);
    }

    public deleteById(fileId:string|cassandra.types.Uuid, next:Function) {
        var query = 'DELETE FROM mindweb.file WHERE id = :fileId';
        this.execute(query, {fileId: fileId}, next);
    }

    public renameById(fileId:string|cassandra.types.Uuid, newName:string, next:Function) {
        var query = 'UPDATE mindweb.file set name=:newName WHERE id = :fileId';
        this.execute(query, {fileId: fileId, newName: newName}, next);
    }

    public shareFile(fileId:string|cassandra.types.Uuid, isPublic:boolean, editors:string[]|cassandra.types.Uuid[], viewers:string[]|cassandra.types.Uuid[], next:Function) {
        var query = 'UPDATE mindweb.file set public=:isPublic, viewers=:viewers, editors=:editors WHERE id = :fileId';
        this.execute(query, {fileId: fileId, isPublic: isPublic, viewers: viewers, editors: editors}, next);
    }
}