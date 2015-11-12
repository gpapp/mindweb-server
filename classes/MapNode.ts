/// <reference path="../typings/tsd.d.ts" />
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
        this.open = toCopy.open;
        this.nodeMarkdown = toCopy.nodeMarkdown;
        this.detailMarkdown = toCopy.detailMarkdown;
        this.detailOpen = toCopy.detailOpen;
        this.noteMarkdown = toCopy.noteMarkdown;
        this.richcontent = toCopy.richcontent;

        if (toCopy.node){
            this.node=[];
            for(var i=0;i<toCopy.node.length;i++){
                this.node.push(new MapNode(toCopy.node[i]));
            }
        }
        if (toCopy.icon){
            this.icon=[];
            for(var i=0;i<toCopy.icon.length;i++){
                this.icon.push(new MapNodeCore(toCopy.icon[i].$));
            }
        }
        if (toCopy.attribute){
            this.attribute=[];
            for(var i=0;i<toCopy.attribute.length;i++){
                this.attribute.push(new MapNodeCore(toCopy.attribute[i].$));
            }
        }
        if (toCopy.hook){
            this.hook=toCopy.hook;
        }
    }

    hasIcon(name:string):boolean {
        if (!this.icon) {
            return false;
        }
        for (var i in this.icon){
            var curItem:MapNodeCore = this.icon[i];
            if (curItem.$['BUILTIN']===name){
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
        var newAttribute = new MapNodeCore({"NAME": name, "VALUE": value});
        if (!this.attribute) {
            this.attribute = []
        }
        this.attribute.push(newAttribute);
    }

    removeAttribute(name:String):boolean {
        if (!this.attribute) {
            return false;
        }
        for (var i=0;i<this.attribute.length;i++){
            if (this.attribute[i].$['NAME']===name){
                this.attribute.splice(i,1);
                return true;
            }
        }
        return false;
    }

    getAttribute(name:String):string {
        if (!this.attribute) {
            return null;
        }
        for (var i=0;i<this.attribute.length;i++){
            if (this.attribute[i].$['NAME']===name){
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
