import * as xml2js from 'xml2js';
import * as Showdown from 'showdown';
const urlPattern = /(^|[\s\n]|<br\/?>)((?:https?|ftp):\/\/[\-A-Z0-9+\u0026\u2019@#\/%?=()~_|!:,.;]*[\-A-Z0-9+\u0026@#\/%=~()_|])/gi;

const mapBuilder = new xml2js.Builder({rootName: 'map', headless: true, renderOpts: {pretty: true}});
const htmlBuilder = new xml2js.Builder({rootName: 'html', headless: true, renderOpts: {pretty: true}});
const converter = new Showdown.converter();
const toMarkdown = require('to-markdown');

export function fromFreeplane(buffer, callback) {
    // XML to JSON
    xml2js.parseString(buffer.toString(), {trim: true}, function (err, result) {
        if (err) {
            return callback(err);
        }
        try {
            buildMarkdownContent(result.map);
        } catch (e) {
            return callback(e);
        }
        result.map.rootNode = result.map.node[0];
        delete result.map.node;
        callback(null, result.map);
    })
}

function buildMarkdownContent(node) {
    if (node.$ && node.$['TEXT']) {
        node.nodeMarkdown = node.$['TEXT'];
    }
    if (node.richcontent) {
        for (var i = 0, len = node.richcontent.length; i < len; i++) {
            var richNode = node.richcontent[i];
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
        delete node.richcontent;
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

function buildMarkdownContentForNode(node) {
    var buildObject = htmlBuilder.buildObject(node.html[0]);
    return toMarkdown(buildObject);
}

export function toFreeplane(content, callback) {
    content.node = [content.rootNode];
    delete content.rootNode;

    removeMarkdown(content.node);

    var profiles = mapBuilder.buildObject(content);
    callback(null, profiles);
}

function removeMarkdown(nodes) {
    for (var i in nodes) {
        var curnode = nodes[i];
        if (curnode.nodeMarkdown) {
            var richnode = {$: {TYPE: 'NODE'}, html: markdownToHTML(curnode.nodeMarkdown)};
            if (!curnode.richcontent) {
                curnode.richcontent = [richnode];
            } else {
                curnode.richcontent.push(richnode);
            }
            curnode.$['TEXT'] = curnode.nodeMarkdown;
            delete curnode.nodeMarkdown;
        }
        if (curnode.detailMarkdown) {
            var richnode = {
                $: {TYPE: 'DETAILS', HIDDEN: !curnode.detailOpen},
                html: markdownToHTML(curnode.detailMarkdown)
            };
            if (!curnode.richcontent) {
                curnode.richcontent = [richnode];
            } else {
                curnode.richcontent.push(richnode);
            }
            delete curnode.detailOpen;
            delete curnode.detailMarkdown;
        }
        if (curnode.noteMarkdown) {
            var richnode = {$: {TYPE: 'NOTE'}, html: markdownToHTML(curnode.noteMarkdown)};
            if (!curnode.richcontent) {
                curnode.richcontent = [richnode];
            } else {
                curnode.richcontent.push(richnode);
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


function markdownToHTML(content) {
    var retval = converter.makeHtml(content);
    xml2js.parseString('<body>' + retval + '</body>', {trim: true, async: false}, function (error, result) {
        retval = result;
    });
    return {
        head: {},
        body: retval.body
    };
}