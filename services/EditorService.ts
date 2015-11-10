/// <reference path="../typings/tsd.d.ts" />
import EditAction from "../classes/EditAction";
import FileContent from "../classes/FileContent";
import MapNode from "../classes/MapNode";
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
            for (var i=0;i<eventNode.node.length;i++){
                if (eventNode.node[i].$['ID']===action.payload){
                    eventNode.node.splice(i,1);
                    break;
                }
            }
            if (eventNode.node.length==0){
                delete eventNode.node;
                delete eventNode.open;
            }
            break;
        case 'nodeMove':
            var elementId:string = action.payload['elementId'];
            var fromIndex:number = action.payload['fromIndex'];
            var toParentId:string = action.payload['toParentId'];
            var toIndex:number = action.payload['toIndex'];
            var element:MapNode = findNodeById(eventNode,elementId);
            if (!element){
                return callback('Cannot find element to move: ' + elementId);
            }
            var toParent:MapNode = findNodeById(file.rootNode,toParentId);
            if (!toParent){
                return callback('Cannot find element to move to: ' + toParentId);
            }
            eventNode.node.splice(fromIndex,1);
            if (eventNode.node.length==0){
                delete eventNode.node;
                delete eventNode.open;
            }
            toParent.node.splice(toIndex,0,element);
            break;
        default:
            return callback('Unimplemented event: ' + action.event);
    }
    callback();
}
