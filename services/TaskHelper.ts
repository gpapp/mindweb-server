import * as async from 'async';
import * as cassandra from 'cassandra-driver';

import FileContent from "../classes/FileContent";
import MapNode from "../classes/MapNode";
import Task from "../classes/Task";

import * as ConverterHelper from './ConverterHelper';

class IconConfigItem {
    constructor(name:string, value:string) {
        this.name = name;
        this.value = value;
    }

    name:string;
    value:string;
}
class IconConfig {
    config:IconConfigItem[];

    constructor() {
        this.config = [];
        this.config.push(new IconConfigItem('project', 'list'));
        this.config.push(new IconConfigItem('task', 'yes'));
        this.config.push(new IconConfigItem('nextAction', 'bookmark'));
        this.config.push(new IconConfigItem('done', 'button_ok'));
    }

    addIcon(icon:IconConfigItem) {
        this.config = this.config.filter(function (v:IconConfigItem):boolean {
            return v.name != icon.name;
        });
        this.config.push(icon);
    }

    getIcon(name:string):string {
        for (var i in this.config) {
            var cur:IconConfigItem = this.config[i];
            if (cur.name === name) {
                return cur.value;
            }
        }
        return null;
    }
}

export function nodeToTask(node:MapNode, config:IconConfig):Task {
    var retval = new Task();
    retval.description = node.nodeMarkdown;
    return retval;
}

export function parseConfig(file:FileContent):IconConfig {
    var config:IconConfig = new IconConfig();
    var iconRex:RegExp = /^Icon: (.*)/;
    var config:IconConfig = new IconConfig();
    file.recurseNodes(function (node:MapNode):boolean {
        if (iconRex.test(node.nodeMarkdown)) {
            var res:RegExpExecArray = iconRex.exec(node.nodeMarkdown);
            config.addIcon(new IconConfigItem(res[1], node.icon[0].$['BUILTIN']));
        }
        return false;
    });
    return config;
}

export function parseTasks(file:FileContent) {
    var taskRex:RegExp = /^\*(.*)/;

    var config:IconConfig = parseConfig(file);
    file.recurseNodes(function (node:MapNode):boolean {
        if (taskRex.test(node.nodeMarkdown)) {
            var newTask = nodeToTask(node, config);
            var taskIcon = config.getIcon("task");
            if (!node.hasIcon(taskIcon)) {
                node.addIcon(taskIcon);
            }
            if (newTask.context) {
                node.addAttribute("Where", newTask.context.join(','));
                for (var j in newTask.context) {
                    var curContext:string = newTask.context[j];
                    var curIcon:string = config.getIcon("@" + curContext);
                    if (!node.hasIcon(curIcon)) {
                        node.addIcon(curIcon);
                    }
                }
            }
        }
        return false;
    });
}
