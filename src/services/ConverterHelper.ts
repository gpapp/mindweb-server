import * as xml2js from 'xml2js';
import * as markdown from 'markdown';

import {MapNode} from "mindweb-request-classes";
import {MapContent} from "mindweb-request-classes";
import {ServiceError} from "mindweb-request-classes";


const mapBuilder = new xml2js.Builder({rootName: 'map', headless: true, renderOpts: {pretty: true}});
const htmlBuilder = new xml2js.Builder({rootName: 'html', headless: true, renderOpts: {pretty: true}});
const toMarkdown = require('to-markdown');

export function fromFreeplane(buffer:Buffer, callback:(error:ServiceError, result?:MapContent)=>void) {
    // XML to JSON
    xml2js.parseString(buffer.toString(), {trim: true}, function (err, result:{map:{$:any,node:MapNode[]}}) {
            if (err) {
                return callback(err);
            }

            const retval:MapContent = new MapContent({$: result.map.$, rootNode: result.map.node[0]});
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
    const richcontent = node['richcontent'];
    if (richcontent) {
        for (let i = 0, len = richcontent.length; i < len; i++) {
            const richNode = richcontent[i];
            if (richNode === '') {
                continue;
            }
            const markdown = buildMarkdownContentForNode(richNode);
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
    for (const attr in node) {
        if (!node.hasOwnProperty(attr) || attr === '$') {
            continue;
        }
        if (attr === 'nodeMarkdown' || attr === 'detailMarkdown' || attr === 'noteMarkdown' ||
            attr === 'open' || attr === 'detailOpen' || attr === 'richcontent') {

        } else if (Array.isArray(node[attr])) {
            for (let i = 0, len = node[attr].length; i < len; i++) {
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
    const buildObject = htmlBuilder.buildObject(node['html'][0]);
    return toMarkdown(buildObject, {gfm: true});
}

export function toFreeplane(content:MapContent, callback:(error:ServiceError, result:string)=>void) {
    content['node'] = [content.rootNode];

    removeMarkdown(content['node']);
    delete content.rootNode;


    const profiles:string = mapBuilder.buildObject(content);
    callback(null, profiles);
}

function removeMarkdown(nodes:MapNode[]):void {
    for (let i in nodes) {
        const curnode:MapNode = nodes[i];
        const content:string = markdown.parse(curnode.nodeMarkdown);
        delete curnode['richcontent'];
        if (content != "<p>" + curnode.nodeMarkdown + "</p>") {
            const richContent = markdownToHTML(content);
            if (richContent) {
                const richnode = {
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
            const richnode = {
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
            const richnode = {
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

