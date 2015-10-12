/// <reference path="../typings/tsd.d.ts" />
import DAOBase from './DAOBase';
import * as cassandra from 'cassandra-driver';

export default class Friend extends DAOBase {

    public getFriend(authId:string, next:Function) {
        var query = 'SELECT authId, name, email, avatarUrl, created, modified FROM mindweb.user_persona ' +
            'WHERE authId = :authId';
        this.execute(query, {authId: authId}, next);
    }

    public createFriend(authId:string, name:string, email:string, avatarUrl:string, next:Function) {
        var query = 'INSERT INTO mindweb.user_persona (authId, name, email, avatarUrl, created, modified) ' +
            'VALUES (:authId, :name, :email, :avatarUrl, dateOf(now()), dateOf(now()))';
        this.execute(query, {authId: authId, name: name, email: email, avatarUrl: avatarUrl}, next);
    }

    public deleteFriend(authId:string, next:Function) {
        var query = 'DELETE FROM mindweb.user_persona WHERE authid=:authId';
        this.execute(query, {authId: authId}, next);
    }

}