/// <reference path="../typings/tsd.d.ts" />
import User from "./User";
import * as cassandra from 'cassandra-driver';

export default class File {
    id:string|cassandra.types.Uuid;
    name:string;
    owner:string|cassandra.types.Uuid;
    viewers:string[]|cassandra.types.Uuid[];
    editors:string[]|cassandra.types.Uuid[];
    isPublic:boolean;
    versions:string[]|cassandra.types.Uuid[];

    public constructor(id:string|cassandra.types.Uuid,
                       name:string, owner:string|cassandra.types.Uuid,
                       viewers:string[]|cassandra.types.Uuid[],
                       editors:string[]|cassandra.types.Uuid[],
                       isPublic:boolean,
                       versions:string[]|cassandra.types.Uuid[]) {
        this.id = id;
        this.name = name;
        this.owner = owner;
        this.viewers = viewers;
        this.editors = editors;
        this.isPublic = isPublic;
        this.versions = versions;
    }

    public canView(userId:string|cassandra.types.Uuid):boolean {
        var strUserId = userId.toString();
        if (this.isPublic) return true;
        if (this.canEdit(userId)) {
            return true;
        }

        // TODO: Known issue: viewers is a Uuid[] user.id is a string
        if (this.viewers != null) {
            if (strUserId in this.viewers) {
                return true;
            }
        }
        return false;
    }

    public canEdit(userId:string|cassandra.types.Uuid):boolean {
        var strUserId = userId.toString();
        if (this.canRemove(userId)) {
            return true;
        }
        // TODO: Known issue: viewers is a Uuid[] user.id is a string
        if (this.editors != null) {
            if (strUserId in this.editors) {
                return true;
            }
        }
        return false;
    }

    public canRemove(userId:string|cassandra.types.Uuid):boolean {
        return this.owner.toString() === userId.toString();
    }
}