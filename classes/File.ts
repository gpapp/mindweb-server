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

    public canView(user:User):boolean {
        if (this.owner.toString() === user.id) return true;
        if (this.isPublic) return true;

        // TODO: Known issue: viewers is a Uuid[] user.id is a string
        if (this.viewers != null) {
            if (user.id.toString() in this.viewers) {
                return true;
            }
        }
        // TODO: Known issue: viewers is a Uuid[] user.id is a string
        if (this.editors != null) {
            if (user.id.toString() in this.editors) {
                return true;
            }
        }
        return false;
    }

    public canEdit(user:User):boolean {
        if (this.owner.toString() === user.id) return true;
        // TODO: Known issue: viewers is a Uuid[] user.id is a string
        if (this.editors != null) {
            if (user.id.toString() in this.editors) {
                return true;
            }
        }
        return false;
    }

    public canRemove(user:User):boolean {
        if (this.owner.toString() === user.id) return true;
        return false;
    }
}