/// <reference path="../typings/tsd.d.ts" />
import EditAction from "../classes/EditAction";
import FileContent from "../classes/FileContent";
import MapNode from "../classes/MapNode";

export function findNodeById(node:MapNode, nodeId:string) {
    if (node.$['ID'] === nodeId) {
        return node;
    }
    if (!node.node) {
        return null;
    }
    for (var index in node.node) {
        if (!node.node.hasOwnProperty(index)) {
            continue;
        }
        var found = findNodeById(node.node[index], nodeId);
        if (found) {
            return found;
        }
    }
    return null;
}

export function applyAction(file:FileContent, action:EditAction, callback:Function) {
    var eventNode = findNodeById(file.rootNode, action.parent);
    if (!eventNode) {
        callback('Cannot find root node with id:' + action.parent);
        return;
    }
    switch (action.event) {
        case 'nodeFold':
            eventNode.open = action.payload;
            break;
        case 'nodeDetailFold':
            eventNode.detailOpen = action.payload;
            break;
        case 'nodeText':
            eventNode.nodeMarkdown = action.payload;
            break;
        case 'nodeDetail':
            eventNode.detailMarkdown = action.payload;
            break;
        case 'nodeNote':
            eventNode.noteMarkdown = action.payload;
            break;
        case 'nodeModifyIcons':
            eventNode.icon = action.payload;
            break;
        case 'newNode':
            // TODO: sanitize node, add proper ids
            if (!eventNode.node) {
                eventNode.node = [];
            }
            eventNode.node.push(action.payload);
            break;
        case 'deleteNode':
            //TODO delete eventNode;
            break;
        default:
            return callback('Unimplemented event: ' + action.event);
    }
    callback();
}
