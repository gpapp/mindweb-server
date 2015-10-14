/// <reference path="../typings/tsd.d.ts" />
import DAOBase from './DAOBase';
import * as cassandra from 'cassandra-driver';

export default class Friend extends DAOBase {

    public getFriendById(id:string|cassandra.types.Uuid, next:Function) {
        var query = 'SELECT id, owner, alias, linked_user, created, modified FROM mindweb.friends ' +
            'WHERE id = :id';
        this.execute(query, {id: id}, next);
    }

    public getFriends(userId:string|cassandra.types.Uuid, next:Function) {
        var query = 'SELECT id, owner, alias, linked_user, created, modified FROM mindweb.friends ' +
            'WHERE owner = :owner';
        this.execute(query, {owner: userId}, next);
    }

    public getFriendOfList(userId:string|cassandra.types.Uuid, next:Function) {
        var query = 'SELECT id, owner, alias, linked_user, created, modified FROM mindweb.friends ' +
            'WHERE linked_user = :userId';
        this.execute(query, {userId: userId}, next);
    }

    public getExactFriendById(userId:string|cassandra.types.Uuid, linkedUser:string|cassandra.types.Uuid, next:Function) {
        var query = 'SELECT id, owner, alias, linked_user, created, modified FROM mindweb.friends ' +
            'WHERE owner = :owner AND linked_user = :linkedUser ALLOW FILTERING';
        this.execute(query, {owner: userId, linkedUser: linkedUser}, next);
    }

    public getExactFriendByAlias(userId:string|cassandra.types.Uuid, alias:string, next:Function) {
        var query = 'SELECT id, owner, alias, linked_user, created, modified FROM mindweb.friends ' +
            'WHERE owner = :owner AND alias = :alias ALLOW FILTERING';
        this.execute(query, {owner: userId, alias: alias}, next);
    }

    public createFriend(id:string|cassandra.types.Uuid,
                        owner:string|cassandra.types.Uuid,
                        alias:string,
                        linkedUser:string|cassandra.types.Uuid,
                        next:Function) {
        var query = 'INSERT INTO mindweb.friends (id, owner, alias, linked_user, created, modified) ' +
            'VALUES (:id, :owner, :alias, :linkedUser, dateOf(now()), dateOf(now()))';
        this.execute(query, {id: id, owner: owner, alias: alias, linkedUser: linkedUser}, next);
    }

    public deleteFriend(id:string|cassandra.types.Uuid, next:Function) {
        var query = 'DELETE FROM mindweb.friends WHERE id=:id';
        this.execute(query, {id: id}, next);
    }

}