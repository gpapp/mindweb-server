/// <reference path="../typings/tsd.d.ts" />
import DAOBase from './DAOBase';
import * as cassandra from 'cassandra-driver';

export default class File extends DAOBase {
    public getFiles(userId:string|cassandra.types.Uuid, next:Function) {
        var query = 'SELECT id, name, owner, versions, public, viewers, editors, tags, created, modified ' +
            'FROM mindweb.file WHERE owner=:userId ALLOW FILTERING';
        this.execute(query, {userId: userId}, next);
    }

    public getFile(fileId:string|cassandra.types.Uuid, next:Function) {
        var query = 'SELECT id, name, owner, public, viewers, editors, versions, tags, created, modified ' +
            'FROM mindweb.file WHERE id=:fileId';
        this.execute(query, {fileId: fileId}, next);
    }

    public createFile(fileId:string|cassandra.types.Uuid, fileName:string, userId:string|cassandra.types.Uuid,
                      isPublic:boolean, viewers:(string|cassandra.types.Uuid)[], editors:(string|cassandra.types.Uuid)[],
                      versions:(string|cassandra.types.Uuid)[], tags:string[], next:Function) {
        var query = 'INSERT INTO mindweb.file (id, name, owner, public, viewers, editors, versions, tags, created, modified)' +
            'VALUES (:fileId, :fileName, :userId, :isPublic, :viewers, :editors, :versions, :tags, dateOf(now()), dateOf(now()))';
        this.execute(query, {
            fileId: fileId,
            fileName: fileName,
            userId: userId,
            isPublic: isPublic,
            viewers: viewers,
            editors: editors,
            versions: versions,
            tags: tags
        }, next);
    }

    public updateFile(fileId:string|cassandra.types.Uuid, fileName:string,
                      isPublic:boolean, viewers:(string|cassandra.types.Uuid)[], editors:(string|cassandra.types.Uuid)[],
                      versions:(string|cassandra.types.Uuid)[], tags:string[], next:Function) {
        var query = 'UPDATE mindweb.file SET' +
            ' name = :name,' +
            ' public = :isPublic,' +
            ' viewers = :viewers,' +
            ' editors = :editors,' +
            ' versions = :versions,' +
            ' tags = :tags,' +
            ' modified = dateOf(now())' +
            ' WHERE id = :fileId';
        this.execute(query, {
            fileId: fileId,
            name: fileName,
            isPublic: isPublic,
            viewers: viewers,
            editors: editors,
            versions: versions,
            tags: tags
        }, next);
    }

    public tagFile(fileId:string|cassandra.types.Uuid, tag:string, next:Function) {
        var query = 'UPDATE mindweb.file SET tags = tags + :tag WHERE id = :fileId';
        this.execute(query, {fileId: fileId, tag: [tag]}, next);
    }

    public untagFile(fileId:string|cassandra.types.Uuid, tag:string, next:Function) {
        var query = 'UPDATE mindweb.file SET tags = tags - :tag WHERE id = :fileId';
        this.execute(query, {fileId: fileId, tag: [tag]}, next);
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

    public shareFile(fileId:string|cassandra.types.Uuid,
                     isPublic:boolean, viewers:(string|cassandra.types.Uuid)[], editors:(string|cassandra.types.Uuid)[],
                     next:Function) {
        var query = 'UPDATE mindweb.file set public=:isPublic, viewers=:viewers, editors=:editors WHERE id = :fileId';
        this.execute(query, {fileId: fileId, isPublic: isPublic, viewers: viewers, editors: editors}, next);
    }

    public tagQuery(userId:string|cassandra.types.Uuid, next:Function) {
        var query;
        query = 'SELECT tags from mindweb.file WHERE owner = :userId';
        this.execute(query, {userId: userId}, next);
    }
}