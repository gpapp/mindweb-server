import MapNodeCore from "./MapNodeCore";

export default class MapNode extends MapNodeCore {
    public node:MapNode[];
    public open:boolean;
    public nodeMarkdown:string;
    public detailMarkdown:string;
    public detailOpen:boolean;
    public noteMarkdown:string;
    public icon:MapNodeCore[];
    public attribute:MapNodeCore[];
    //Copy as-is
    private hook:Object[];
    private richcontent;

    constructor(toCopy:any) {
        super(toCopy.$);
        if (toCopy.open) {
            this.open = toCopy.open;
        }
        if (toCopy.nodeMarkdown) {
            this.nodeMarkdown = toCopy.nodeMarkdown;
        }
        if (toCopy.detailMarkdown) {
            this.detailMarkdown = toCopy.detailMarkdown;
        }
        if (toCopy.detailOpen) {
            this.detailOpen = toCopy.detailOpen;
        }
        if (toCopy.noteMarkdown) {
            this.noteMarkdown = toCopy.noteMarkdown;
        }
        if (toCopy.richcontent) {
            this.richcontent = toCopy.richcontent;
        }

        if (toCopy.node) {
            this.node = [];
            for (var i = 0; i < toCopy.node.length; i++) {
                this.node.push(new MapNode(toCopy.node[i]));
            }
        }
        if (toCopy.icon) {
            this.icon = [];
            for (var i = 0; i < toCopy.icon.length; i++) {
                this.icon.push(new MapNodeCore(toCopy.icon[i].$));
            }
        }
        if (toCopy.attribute) {
            this.attribute = [];
            for (var i = 0; i < toCopy.attribute.length; i++) {
                this.attribute.push(new MapNodeCore(toCopy.attribute[i].$));
            }
        }
        if (toCopy.hook) {
            this.hook = toCopy.hook;
        }
    }

    hasIcon(name:string):boolean {
        if (!this.icon) {
            return false;
        }
        for (var i = 0; i < this.icon.length; i++) {
            var curItem:MapNodeCore = this.icon[i];
            if (curItem.$['BUILTIN'] === name) {
                return true;
            }
        }
        return false;
    }

    addIcon(name:string):void {
        var newIcon = new MapNodeCore({"BUILTIN": name});
        if (!this.icon) {
            this.icon = []
        }
        this.icon.push(newIcon);
    }

    addAttribute(name:string, value:string):void {
        if (!this.attribute) {
            this.attribute = []
        }
        var done = false;
        for (var i = 0; i < this.attribute.length; i++) {
            if (this.attribute[i].$['NAME'] === name) {
                if (!done) {
                    this.attribute[i].$['VALUE'] = value;
                    done = true;
                } else {
                    this.attribute.splice(i, 1);
                }
            }
        }
        if (!done) {
            this.attribute.push(new MapNodeCore({"NAME": name, "VALUE": value}));
        }
    }

    removeAttribute(name:String):boolean {
        if (!this.attribute) {
            return false;
        }
        for (var i = 0; i < this.attribute.length; i++) {
            if (this.attribute[i].$['NAME'] === name) {
                this.attribute.splice(i, 1);
                return true;
            }
        }
        return false;
    }

    getAttribute(name:String):string {
        if (!this.attribute) {
            return null;
        }
        for (var i = 0; i < this.attribute.length; i++) {
            if (this.attribute[i].$['NAME'] === name) {
                return this.attribute[i].$['VALUE'];
            }
        }
        return null;
    }

    public recurseNodes(f:(node:MapNode)=>boolean):boolean {
        for (var i = 0; i < this.node.length; i++) {
            var curNode = this.node[i];
            var stop = f(curNode);
            if (!stop && curNode.node) {
                curNode.recurseNodes(f);
            }
            if (stop) {
                return true;
            }
        }
        return false;
    }
}
