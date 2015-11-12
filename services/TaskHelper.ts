import * as async from 'async';
import * as cassandra from 'cassandra-driver';

import FileContent from "../classes/FileContent";
import MapNode from "../classes/MapNode";
import Task from "../classes/Task";

import * as ConverterHelper from './ConverterHelper';
import * as FilterHelper from './FilterHelper';

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
    var toParse = node.nodeMarkdown;
    var taskRe:RegExp = /^\*\s*(.*)\s*?$/g;
    var contextRe:RegExp = /@([^\s\{\[#]*)/;
    var prioRe:RegExp = /#([0-9])/;
    var dueRe:RegExp = /\{\s*(.*)\s*\}/;
    var whoRe:RegExp = /\[\s*(.*)\s*\]/;

    while (prioRe.test(toParse)) {
        var prio = prioRe.exec(toParse)[1];
        retval.priority = parseInt(prio);
        toParse = toParse.replace(prioRe, ' ');
    }
    while (dueRe.test(toParse)) {
        retval.due = dueRe.exec(toParse)[1];
        toParse = toParse.replace(dueRe, ' ');
    }
    while (contextRe.test(toParse)) {
        if (!retval.context) {
            retval.context = [];
        }
        retval.context = retval.context.concat(contextRe.exec(toParse)[1].split(',')).filter(FilterHelper.uniqueFilterIgnoreCase);
        toParse = toParse.replace(contextRe, ' ');
    }
    while (whoRe.test(toParse)) {
        if (!retval.responsible) {
            retval.responsible = [];
        }
        retval.responsible = retval.responsible.concat(whoRe.exec(toParse)[1].split(',')).filter(FilterHelper.uniqueFilterIgnoreCase);
        toParse = toParse.replace(whoRe, ' ');
    }
    toParse = toParse.replace(taskRe, '$1').replace(/\s+/g, ' ').replace(/\s+$/, '');
    retval.description = toParse;
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
            node.nodeMarkdown = newTask.description;
            if (!node.hasIcon(taskIcon)) {
                node.addIcon(taskIcon);
            }
            if (newTask.context) {
                node.removeAttribute('Where');
                node.addAttribute("Where", newTask.context.join(','));
                for (var j in newTask.context) {
                    var curContext:string = newTask.context[j];
                    var curIcon:string = config.getIcon("@" + curContext);
                    if (curIcon && !node.hasIcon(curIcon)) {
                        node.addIcon(curIcon);
                    }
                }
            }
            if (newTask.responsible) {
                node.removeAttribute('Who');
                node.addAttribute("Who", newTask.responsible.join(','));
            }
            if (newTask.due) {
                node.removeAttribute('When');
                node.addAttribute("When", newTask.due);
            }
            if (newTask.priority) {
                node.removeAttribute('Priority');
                node.addAttribute("Priority", newTask.priority);
            }
        }
        return false;
    });
}
