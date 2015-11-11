/// <reference path="../typings/tsd.d.ts" />
import DAOBase from './DAOBase';
import * as cassandra from 'cassandra-driver';
import ServiceError from "../classes/ServiceError";

export default class User extends DAOBase {
    public getUserByAuthId(authId:string, next:(error:ServiceError,result:cassandra.ExecuteResult)=>void) {
        var query = 'SELECT id, persona, name, email, avatarUrl, created, modified FROM mindweb.user ' +
            'WHERE persona CONTAINS :authId';
        this.execute(query, {authId: authId}, next);
    }

    public getUserById(id:string|cassandra.types.Uuid, next:(error:ServiceError,result:cassandra.ExecuteResult)=>void) {
        var query = 'SELECT id, persona, name, email, avatarUrl, created, modified FROM mindweb.user ' +
            'WHERE id=:id';
        this.execute(query, {id: id}, next);
    }

    public createUser(userId:string|cassandra.types.Uuid, persona:string[], name:string, email:string, avatarUrl:string, next:(error:ServiceError,result:cassandra.ExecuteResult)=>void) {
        var query = 'INSERT INTO mindweb.user (id, persona, name, email, avatarUrl, created, modified) ' +
            'VALUES (:userId, :persona, :name, :email, :avatarUrl, dateOf(now()), dateOf(now()))';
        this.execute(query, {userId: userId, persona: persona, name: name, email: email, avatarUrl: avatarUrl}, next);
    }

    public deleteUser(userId:string|cassandra.types.Uuid, next:(error:ServiceError,result:cassandra.ExecuteResult)=>void) {
        var query = 'DELETE FROM mindweb.user WHERE id=:userId';
        this.execute(query, {userId: userId}, next);
    }
}