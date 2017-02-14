import * as async from 'async';
import * as cassandra from 'cassandra-driver';

import FileContent from "map-editor/dist/classes/FileContent";
import MapNode from "map-editor/dist/classes/MapNode";
import Task from "../classes/Task";

import * as ConverterHelper from './ConverterHelper';
import * as FilterHelper from './FilterHelper';

const taskRe:RegExp = /^\*\s*(.*)\s*?$/g;
const contextRe:RegExp = /@([^\s\{\[#]*)/;
const prioRe:RegExp = /#([0-9])/;
const dueRe:RegExp = /\{\s*(.*)\s*}/;
const whoRe:RegExp = /\[\s*(.*)\s*]/;
const iconRe:RegExp = /^Icon: (.*)/;

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
        this.config.push(new IconConfigItem('Project', 'list'));
        this.config.push(new IconConfigItem('Task', 'yes'));
        this.config.push(new IconConfigItem('NextAction', 'bookmark'));
        this.config.push(new IconConfigItem('Done', 'button_ok'));
    }

    addIcon(icon:IconConfigItem) {
        this.config = this.config.filter(function (v:IconConfigItem):boolean {
            return v.name.toLocaleLowerCase() != icon.name.toLocaleLowerCase();
        });
        this.config.push(icon);
    }

    configToIcon(name:string):string {
        for (var i = 0; i < this.config.length; i++) {
            var cur:IconConfigItem = this.config[i];
            if (cur.name.toLowerCase() === name.toLowerCase()) {
                return cur.value;
            }
        }
        return null;
    }

    iconToConfig(value:string):string {
        for (var i = 0; i < this.config.length; i++) {
            var cur:IconConfigItem = this.config[i];
            if (cur.value.toLowerCase() === value.toLowerCase()) {
                return cur.name;
            }
        }
        return null;
    }
}

export function nodeToTask(node:MapNode, config:IconConfig):Task {
    var retval = new Task();
    var toParse = node.nodeMarkdown;

    // Initialize with properties already on the node
    if (node.getAttribute('Where')) {
        retval.context = node.getAttribute('Where').split(',').filter(FilterHelper.uniqueFilterIgnoreCase);
    }
    if (node.getAttribute('Who')) {
        retval.responsible = node.getAttribute('Who').split(',').filter(FilterHelper.uniqueFilterIgnoreCase);
    }
    if (node.getAttribute('When')) {
        retval.due = node.getAttribute('When');
    }
    // Resolve icons to contexts
    if (node.icon) {
        for (let i = 0; i < node.icon.length; i++) {
            var result = config.iconToConfig(node.icon[i].$['BUILTIN']);
            if (contextRe.test(result)) {
                if (!retval.context) {
                    retval.context = [];
                }
                retval.context = retval.context.concat(contextRe.exec(result)[1].split(',')).filter(FilterHelper.uniqueFilterIgnoreCase);
            }
        }
    }

    // Parse string for tokens
    while (prioRe.test(toParse)) {
        retval.priority = parseInt(prioRe.exec(toParse)[1]);
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
    file.recurseNodes(function (node:MapNode):boolean {
        if (iconRe.test(node.nodeMarkdown)) {
            var res:RegExpExecArray = iconRe.exec(node.nodeMarkdown);
            if (node.icon) {
                config.addIcon(new IconConfigItem(res[1], node.icon[0].$['BUILTIN']));
            }
        }
        return false;
    });
    return config;
}

export function parseTasks(file:FileContent) {
    var taskRex:RegExp = /^\*(.*)/;

    var config:IconConfig = parseConfig(file);
    file.recurseNodes(function (node:MapNode):boolean {
        if (taskRex.test(node.nodeMarkdown) || node.hasIcon(config.configToIcon('Task'))) {
            var newTask = nodeToTask(node, config);
            var taskIcon = config.configToIcon("task");
            node.nodeMarkdown = newTask.description;
            if (!node.hasIcon(taskIcon)) {
                node.addIcon(taskIcon);
            }
            if (newTask.context) {
                node.removeAttribute('Where');
                node.addAttribute("Where", newTask.context.join(','));
                for (let j = 0; j < newTask.context.length; j++) {
                    var curContext:string = newTask.context[j];
                    var curIcon:string = config.configToIcon("@" + curContext);
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
                node.addAttribute("Priority", newTask.priority.toString());
            }
        }
        return false;
    });
}
