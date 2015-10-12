/// <reference path="../typings/tsd.d.ts" />
export default class MapNode {
    public id:string;
    public $;
    public node:MapNode[];
    public open:boolean;
    public nodeMarkdown:string;
    public detailMarkdown:string;
    public detailOpen:boolean;
    public noteMarkdown:string;
}