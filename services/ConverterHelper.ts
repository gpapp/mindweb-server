import * as xml2js from 'xml2js';
import * as markdown from 'markdown';

import MapNode from 'mindweb-request-classes/dist/classes/MapNode';
import FileContent from "mindweb-request-classes/dist/classes/FileContent";
import ServiceError from "mindweb-request-classes/dist/classes/ServiceError";


const mapBuilder = new xml2js.Builder({rootName: 'map', headless: true, renderOpts: {pretty: true}});
const htmlBuilder = new xml2js.Builder({rootName: 'html', headless: true, renderOpts: {pretty: true}});
const toMarkdown = require('to-markdown');

export function fromFreeplane(buffer:Buffer, callback:(error:ServiceError, result?:FileContent)=>void) {
    // XML to JSON
    xml2js.parseString(buffer.toString(), {trim: true}, function (err, result:{map:{$:any,node:MapNode[]}}) {
            if (err) {
                return callback(err);
            }

            var retval:FileContent = new FileContent({$: result.map.$, rootNode: result.map.node[0]});
            try {
                buildMarkdownContent(retval.rootNode);
            } catch (e) {
                return callback(e);
            }
            callback(null, retval);
        }
    )
}

function buildMarkdownContent(node:MapNode):void {
    cleanNode(node);
    if (node.$ && node.$['TEXT']) {
        node.nodeMarkdown = node.$['TEXT'];
    }
    var richcontent = node['richcontent'];
    if (richcontent) {
        for (var i = 0, len = richcontent.length; i < len; i++) {
            var richNode = richcontent[i];
            if (richNode === '') {
                continue;
            }
            var markdown = buildMarkdownContentForNode(richNode);
            if (markdown) {
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
        }
        delete node['richcontent'];
    }
    for (var attr in node) {
        if (!node.hasOwnProperty(attr) || attr === '$') {
            continue;
        }
        if (attr === 'nodeMarkdown' || attr === 'detailMarkdown' || attr === 'noteMarkdown' ||
            attr === 'open' || attr === 'detailOpen' || attr === 'richcontent') {

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
    if (!node['html']) {
        return null;
    }
    var buildObject = htmlBuilder.buildObject(node['html'][0]);
    return toMarkdown(buildObject, {gfm: true});
}

export function toFreeplane(content:FileContent, callback:(error:ServiceError, result:string)=>void) {
    content['node'] = [content.rootNode];

    removeMarkdown(content['node']);
    delete content.rootNode;


    var profiles:string = mapBuilder.buildObject(content);
    callback(null, profiles);
}

function removeMarkdown(nodes:MapNode[]):void {
    for (var i in nodes) {
        var curnode:MapNode = nodes[i];
        var content:string = markdown.parse(curnode.nodeMarkdown);
        delete curnode['richcontent'];
        if (content != "<p>" + curnode.nodeMarkdown + "</p>") {
            var richContent = markdownToHTML(content);
            if (richContent) {
                var richnode = {
                    $: {TYPE: 'NODE'},
                    html: richContent
                };
                if (!curnode['richcontent']) {
                    curnode['richcontent'] = [];
                }
                curnode['richcontent'].push(richnode);
            }
        }
        curnode.$['TEXT'] = curnode.nodeMarkdown;
        if (curnode.detailMarkdown) {
            var richnode = {
                $: {TYPE: 'DETAILS'},
                html: markdownToHTML(markdown.parse(curnode.detailMarkdown))
            };
            if (richnode) {
                if (!curnode['richcontent']) {
                    curnode['richcontent'] = [];
                }
                curnode['richcontent'].push(richnode);

                richnode.$['HIDDEN'] = !curnode.detailOpen;
            }
        }
        if (curnode.noteMarkdown) {
            var richnode = {
                $: {TYPE: 'NOTE'},
                html: markdownToHTML(markdown.parse(curnode.noteMarkdown))
            };
            if (!curnode['richcontent']) {
                curnode['richcontent'] = [];
            }
            curnode['richcontent'].push(richnode);

        }
        if (curnode.open != null) {
            curnode.$['OPEN'] = curnode.open;
        }
        if (curnode.node) {
            removeMarkdown(curnode.node);
        }
        cleanNode(curnode);
    }
}

function cleanNode(curnode) {
    delete curnode.open;
    delete curnode.nodeMarkdown;
    delete curnode.noteMarkdown;
    delete curnode.detailOpen;
    delete curnode.detailMarkdown;
}

function markdownToHTML(content:string):Object {
    xml2js.parseString('<body>' + content + '</body>', {trim: true, async: false}, function (error, result) {
        if (error) {
            console.error(content);
            console.error(error);
        }
        content = result;
    });
    return {
        head: {},
        body: content['body']
    };
}

