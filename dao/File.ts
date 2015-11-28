/// <reference path="../typings/tsd.d.ts" />
import DAOBase from './DAOBase';
import * as cassandra from 'cassandra-driver';
import ServiceError from "../classes/ServiceError";

export default class File extends DAOBase {
    public getFiles(userId:string|cassandra.types.Uuid, next:(error:ServiceError, result:cassandra.ExecuteResult)=>void) {
        var query = 'SELECT id, name, owner, versions, shareable, public, viewers, editors, tags, created, modified ' +
            'FROM mindweb.file WHERE owner=:userId ALLOW FILTERING';
        this.execute(query, {userId: userId}, next);
    }

    public getPublicFileTags(next:(error:ServiceError, result:cassandra.ExecuteResult)=>void):void {
        var query = 'SELECT tags from mindweb.file WHERE public = True';
        this.execute(query, {}, next);
    }

    public getPublicFiles(next:(error:ServiceError, result:cassandra.ExecuteResult)=>void):void {
        var query = 'SELECT id, name, owner, versions, shareable, public, viewers, editors, tags, created, modified ' +
            'FROM mindweb.file WHERE public = True LIMIT 25 ALLOW FILTERING';
        this.execute(query, {}, next);
    }

    public getPublicFilesForTag(tag:String, next:(error:ServiceError, result:cassandra.ExecuteResult)=>void):void {
        var query = 'SELECT id, name, owner, versions, shareable, public, viewers, editors, tags, created, modified ' +
            'FROM mindweb.file WHERE tags CONTAINS :tag ALLOW FILTERING';
        this.execute(query, {tag: tag}, next);
    }

    public getSharedFilesForEdit(userId:string|cassandra.types.Uuid, next:(error:ServiceError, result:cassandra.ExecuteResult)=>void) {
        var query = 'SELECT id, name, owner, versions, shareable, public, viewers, editors, tags, created, modified ' +
            'FROM mindweb.file WHERE editors CONTAINS :userId ALLOW FILTERING';
        this.execute(query, {userId: userId}, next);
    }

    public getSharedFilesForView(userId:string|cassandra.types.Uuid, next:(error:ServiceError, result:cassandra.ExecuteResult)=>void) {
        var query = 'SELECT id, name, owner, versions, shareable, public, viewers, editors, tags, created, modified ' +
            'FROM mindweb.file WHERE viewers CONTAINS :userId ALLOW FILTERING';
        this.execute(query, {userId: userId}, next);
    }

    public getFile(fileId:string|cassandra.types.Uuid, next:(error:ServiceError, result:cassandra.ExecuteResult)=>void) {
        var query = 'SELECT id, name, owner, shareable, public, viewers, editors, versions, tags, created, modified ' +
            'FROM mindweb.file WHERE id=:fileId';
        this.execute(query, {fileId: fileId}, next);
    }

    public createFile(fileId:string|cassandra.types.Uuid, fileName:string, userId:string|cassandra.types.Uuid,
                      isShareable:boolean, isPublic:boolean, viewers:(string|cassandra.types.Uuid)[], editors:(string|cassandra.types.Uuid)[],
                      versions:(string|cassandra.types.Uuid)[], tags:string[], next:(error:ServiceError, result:cassandra.ExecuteResult)=>void) {
        var query = 'INSERT INTO mindweb.file (id, name, owner, shareable, public, viewers, editors, versions, tags, created, modified)' +
            'VALUES (:fileId, :fileName, :userId, :isShareable, :isPublic, :viewers, :editors, :versions, :tags, dateOf(now()), dateOf(now()))';
        this.execute(query, {
            fileId: fileId,
            fileName: fileName,
            userId: userId,
            isShareable: isShareable,
            isPublic: isPublic,
            viewers: viewers,
            editors: editors,
            versions: versions,
            tags: tags
        }, next);
    }

    public updateFile(fileId:string|cassandra.types.Uuid, fileName:string,
                      isShareable:boolean, isPublic:boolean, viewers:(string|cassandra.types.Uuid)[], editors:(string|cassandra.types.Uuid)[],
                      versions:(string|cassandra.types.Uuid)[], tags:string[], next:(error:ServiceError, result:cassandra.ExecuteResult)=>void) {
        var query = 'UPDATE mindweb.file SET' +
            ' name = :name,' +
            ' shareable = :isShareable,' +
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
            isShareable: isShareable,
            isPublic: isPublic,
            viewers: viewers,
            editors: editors,
            versions: versions,
            tags: tags
        }, next);
    }

    public tagFile(fileId:string|cassandra.types.Uuid, tag:string, next:(error:ServiceError, result:cassandra.ExecuteResult)=>void) {
        var query = 'UPDATE mindweb.file SET tags = tags + :tag WHERE id = :fileId';
        this.execute(query, {fileId: fileId, tag: [tag]}, next);
    }

    public untagFile(fileId:string|cassandra.types.Uuid, tag:string, next:(error:ServiceError, result:cassandra.ExecuteResult)=>void) {
        var query = 'UPDATE mindweb.file SET tags = tags - :tag WHERE id = :fileId';
        this.execute(query, {fileId: fileId, tag: [tag]}, next);
    }

    public getFileByUserAndName(userId:string|cassandra.types.Uuid, fileName:string, next:(error:ServiceError, result:cassandra.ExecuteResult)=>void) {
        var query = 'SELECT id,versions FROM mindweb.file WHERE owner=:userId AND name=:fileName ALLOW FILTERING';
        this.execute(query, {userId: userId, fileName: fileName}, next);
    }

    public deleteById(fileId:string|cassandra.types.Uuid, next:(error:ServiceError, result:cassandra.ExecuteResult)=>void) {
        var query = 'DELETE FROM mindweb.file WHERE id = :fileId';
        this.execute(query, {fileId: fileId}, next);
    }

    public renameById(fileId:string|cassandra.types.Uuid, newName:string, next:(error:ServiceError, result:cassandra.ExecuteResult)=>void) {
        var query = 'UPDATE mindweb.file set name=:newName WHERE id = :fileId';
        this.execute(query, {fileId: fileId, newName: newName}, next);
    }

    public shareFile(fileId:string|cassandra.types.Uuid,
                     isShareable:boolean, isPublic:boolean, viewers:(string|cassandra.types.Uuid)[], editors:(string|cassandra.types.Uuid)[],
                     next:(error:ServiceError, result:cassandra.ExecuteResult)=>void) {
        var query = 'UPDATE mindweb.file set shareable=:isShareable, public=:isPublic, viewers=:viewers, editors=:editors WHERE id = :fileId';
        this.execute(query, {
            fileId: fileId,
            isShareable: isShareable,
            isPublic: isPublic,
            viewers: viewers,
            editors: editors
        }, next);
    }

    public tagQuery(userId:string|cassandra.types.Uuid, next:(error:ServiceError, result:cassandra.ExecuteResult)=>void) {
        var query;
        query = 'SELECT tags from mindweb.file WHERE owner = :userId';
        this.execute(query, {userId: userId}, next);
    }
}