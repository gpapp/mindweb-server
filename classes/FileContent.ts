/// <reference path="../typings/tsd.d.ts" />

import MapNode from "./MapNode";

export default class FileContent {
    public rootNode:MapNode;
    public $;

    public constructor(data?:string|any) {
        if (!data) {
            return;
        }
        if (data instanceof Object) {
            this.$ = data.$;
            this.rootNode = new MapNode(data.node[0]);
        } else {
            var parsed = JSON.parse(data);
            this.$ = parsed.$;
            this.rootNode = parsed.rootNode;
        }
    }

    public recurseNodes(f:(node:MapNode)=>boolean):boolean {
        return this.rootNode.recurseNodes(f);
    }

    public findNodeById(id:String):MapNode {
        var retval = null;
        this.recurseNodes(function (node:MapNode):boolean {
            if (node.$['ID'] === id) {
                retval = node;
                return true;
            }
        });
        return retval;
    }
}
