/// <reference path="../typings/tsd.d.ts" />

import MapNode from "./MapNode";

export default class FileContent {
    public rootNode:MapNode;
    public $;

    public constructor(data:string) {
        var parsed = JSON.parse(data);
        this.$ = parsed.$;
        this.rootNode = parsed.rootNode;
    }
}
