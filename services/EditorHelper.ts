import EditAction from "../classes/EditAction";
import FileContent from "../classes/FileContent";
import MapNode from "../classes/MapNode";
import ServiceError from "../classes/ServiceError";

export function findNodeById(node:MapNode, nodeId:string):MapNode {
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

export function applyAction(file:FileContent, action:EditAction, callback:(error?:ServiceError)=>void) {
    var eventNode:MapNode = findNodeById(file.rootNode, action.parent);
    if (!eventNode) {
        callback(new ServiceError(403,'Cannot find root node with id:' + action.parent,'applyAction'));
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
        case 'nodeSetAttribute':
            eventNode.addAttribute(action.payload.name,action.payload.value);
            break;
        case 'nodeRemoveAttribute':
            eventNode.removeAttribute(action.payload.name);
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
                return callback(new ServiceError(403,'Cannot find element to move: ' + elementId,'applyAction'));
            }
            var toParent:MapNode = findNodeById(file.rootNode,toParentId);
            if (!toParent){
                return callback(new ServiceError(403,'Cannot find element to move to: ' + toParentId,'applyAction'));
            }
            eventNode.node.splice(fromIndex,1);
            if (eventNode.node.length==0){
                delete eventNode.node;
                delete eventNode.open;
            }
            toParent.node.splice(toIndex,0,element);
            break;
        default:
            return callback(new ServiceError(403,'Unimplemented event: ' + action.event,'applyAction'));
    }
    callback();
}
