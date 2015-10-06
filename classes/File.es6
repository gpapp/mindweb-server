export default class File {
    id;
    name;
    owner;
    viewers;
    editors;
    isPublic;
    versions;

    constructor(id, name, owner, viewers, editors, isPublic, versions) {
        this.id = id;
        this.name = name;
        this.owner = owner;
        this.viewers = viewers;
        this.editors = editors;
        this.isPublic = isPublic;
        this.versions = versions;
    }


    canView(user) {
        if (this.owner.toString() === user.id) return true;
        if (this.isPublic) return true;

        // TODO: Known issue: viewers is a Uuid[] user.id is a string
        if (this.viewers != null) {
            if (user.id in this.viewers) {
                return true;
            }
        }
        // TODO: Known issue: viewers is a Uuid[] user.id is a string
        if (this.editors != null) {
            if (user.id in this.editors) {
                return true;
            }
        }
        return false;
    }

    canEdit(user) {
        if (this.owner.toString() === user.id) return true;
        // TODO: Known issue: viewers is a Uuid[] user.id is a string
        if (this.editors != null) {
            if (user.id in this.editors) {
                return true;
            }
        }
        return false;
    }

    canRemove(user) {
        if (this.owner.toString() === user.id) return true;
        return false;
    }
}