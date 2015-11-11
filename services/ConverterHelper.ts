/// <reference path="../typings/tsd.d.ts" />
import * as xml2js from 'xml2js';
import * as markdown from 'markdown';

import MapNode from '../classes/MapNode';
import FileContent from "../classes/FileContent";
import ServiceError from "../classes/ServiceError";


const mapBuilder = new xml2js.Builder({rootName: 'map', headless: true, renderOpts: {pretty: true}});
const htmlBuilder = new xml2js.Builder({rootName: 'html', headless: true, renderOpts: {pretty: true}});
const toMarkdown = require('to-markdown');

export function fromFreeplane(buffer:Buffer, callback:(error:ServiceError, result?:FileContent)=>void) {
    // XML to JSON
    xml2js.parseString(buffer.toString(), {trim: true}, function (err, result:{map:{$:any,node:MapNode[]}}) {
        if (err) {
            return callback(err);
        }
        var retval:FileContent = new FileContent(result.map);
        try {
            buildMarkdownContent(retval.rootNode);
        } catch (e) {
            return callback(e);
        }
        callback(null, retval);
    })
}

function buildMarkdownContent(node:MapNode):void {
    if (node.$ && node.$['TEXT']) {
        node.nodeMarkdown = node.$['TEXT'];
    }
    var richcontent = node['richcontent'];
    if (richcontent) {
        for (var i = 0, len = richcontent.length; i < len; i++) {
            var richNode = richcontent[i];
            var markdown = buildMarkdownContentForNode(richNode);
            switch (richNode.$['TYPE']) {
                case 'NODE':
                    node.nodeMarkdown = markdown;
                    break;
                case 'DETAILS':
                    node.detailMarkdown = markdown;
                    node.detailOpen = richNode.$['HIDDEN'] != 'true';
                    break;
                case 'NOTE':
                    node.noteMarkdown = markdown;
                    break;
                default:
                    console.warn("Unknown richcontent type:" + richNode.$['TYPE']);
            }
        }
        delete node['richcontent'];
    }
    for (var attr in node) {
        if (!node.hasOwnProperty(attr) || attr === '$') {
            continue;
        }
        if (attr === 'nodeMarkdown' || attr === 'detailMarkdown' || attr === 'noteMarkdown' || attr === 'richcontent') {

        } else if (Array.isArray(node[attr])) {
            for (var i = 0, len = node[attr].length; i < len; i++) {
                buildMarkdownContent(node[attr][i]);
            }
        } else {
            console.log('Unknown attribute: ' + attr);
        }
    }
}

function buildMarkdownContentForNode(node:MapNode):string {
    var buildObject = htmlBuilder.buildObject(node['html'][0]);
    return toMarkdown(buildObject, {gfm: true});
}

export function toFreeplane(content:FileContent, callback:(error:ServiceError,result:string)=>void) {
    content['node'] = [content.rootNode];

    removeMarkdown([content.rootNode]);
    delete content.rootNode;


    var profiles:string = mapBuilder.buildObject(content);
    callback(null, profiles);
}

function removeMarkdown(nodes:MapNode[]):void {
    for (var i in nodes) {
        var curnode:MapNode = nodes[i];
        if (curnode.nodeMarkdown) {
            var richnode = {$: {TYPE: 'NODE'}, html: markdownToHTML(curnode.nodeMarkdown)};
            if (!curnode['richcontent']) {
                curnode['richcontent'] = [richnode];
            } else {
                curnode['richcontent'].push(richnode);
            }
            curnode.$['TEXT'] = curnode.nodeMarkdown;
            delete curnode.nodeMarkdown;
        }
        if (curnode.detailMarkdown) {
            var richnode = {
                $: {TYPE: 'DETAILS'},
                html: markdownToHTML(curnode.detailMarkdown)
            };
            if (!curnode['richcontent']) {
                curnode['richcontent'] = [richnode];
            } else {
                curnode['richcontent'].push(richnode);
            }
            richnode.$['HIDDEN'] = !curnode.detailOpen;
            delete curnode.detailOpen;
            delete curnode.detailMarkdown;
        }
        if (curnode.noteMarkdown) {
            var richnode = {$: {TYPE: 'NOTE'}, html: markdownToHTML(curnode.noteMarkdown)};
            if (!curnode['richcontent']) {
                curnode['richcontent'] = [richnode];
            } else {
                curnode['richcontent'].push(richnode);
            }
            delete curnode.noteMarkdown;
        }
        if (curnode.open != null) {
            curnode.$['OPEN'] = curnode.open;
            delete curnode.open;
        }
        if (curnode.node) {
            removeMarkdown(curnode.node);
        }
    }
}


function markdownToHTML(content:string):Object {
    var retval = markdown.parse(content);
    xml2js.parseString('<body>' + retval + '</body>', {trim: true, async: false}, function (error, result) {
        if (error) {
            console.error(content);
            console.error(retval);
            console.error(error);
        }
        retval = result;
    });
    return {
        head: {},
        body: retval['body']
    };
}

