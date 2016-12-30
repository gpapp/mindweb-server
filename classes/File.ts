import User from "./User";
import * as cassandra from '@types/cassandra-driver';

export default class File {
    id:string|cassandra.types.Uuid;
    name:string;
    owner:string|cassandra.types.Uuid;
    isShareable:boolean;
    isPublic:boolean;
    viewers:(string|cassandra.types.Uuid)[];
    editors:(string|cassandra.types.Uuid)[];
    versions:(string|cassandra.types.Uuid)[]
    tags:string[];

    public constructor(id:string|cassandra.types.Uuid,
                       name:string, owner:string|cassandra.types.Uuid,
                       viewers:(string|cassandra.types.Uuid)[],
                       editors:(string|cassandra.types.Uuid)[],
                       isShareable:boolean,
                       isPublic:boolean,
                       versions:(string|cassandra.types.Uuid)[],
                       tags:string[]) {
        this.id = id;
        this.name = name;
        this.owner = owner;
        this.viewers = viewers;
        this.editors = editors;
        this.isShareable = isShareable;
        this.isPublic = isPublic;
        this.versions = versions;
        this.tags = tags;
    }

    public canView(userId:string|cassandra.types.Uuid):boolean {
        if (this.isPublic) return true;
        if (this.isShareable) return true;
        if(!userId) {
            return false;
        }
        var strUserId = userId.toString();
        if (this.canEdit(userId)) {
            return true;
        }

        if (this.viewers != null) {
            for (var i in this.viewers) {
                var strViewer = this.viewers[i].toString();
                if (strUserId === strViewer) {
                    return true;
                }
            }
        }
        return false;
    }

    public canEdit(userId:string|cassandra.types.Uuid):boolean {
        if(!userId) {
            return false;
        }
        var strUserId = userId.toString();
        if (this.canRemove(userId)) {
            return true;
        }
        if (this.editors != null) {
            for (var i in this.editors) {
                var strEditor = this.editors[i].toString();
                if (strUserId === strEditor) {
                    return true;
                }
            }
        }
        return false;
    }

    public canRemove(userId:string|cassandra.types.Uuid):boolean {
        if(!userId) {
            return false;
        }
        return this.owner.toString() === userId.toString();
    }

}