import {MapContent} from "mindweb-request-classes";
import {MapNode} from "mindweb-request-classes";
import {Task} from "mindweb-request-classes";
import * as FilterHelper from "./FilterHelper";

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
        for (let i = 0; i < this.config.length; i++) {
            const cur:IconConfigItem = this.config[i];
            if (cur.name.toLowerCase() === name.toLowerCase()) {
                return cur.value;
            }
        }
        return null;
    }

    iconToConfig(value:string):string {
        for (let i = 0; i < this.config.length; i++) {
            const cur:IconConfigItem = this.config[i];
            if (cur.value.toLowerCase() === value.toLowerCase()) {
                return cur.name;
            }
        }
        return null;
    }
}

export function nodeToTask(node:MapNode, config:IconConfig):Task {
    const retval = new Task();
    let toParse = node.nodeMarkdown;

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
            const result = config.iconToConfig(node.icon[i].$['BUILTIN']);
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

export function parseConfig(file:MapContent):IconConfig {
    const config:IconConfig = new IconConfig();
    file.recurseNodes(function (node:MapNode):boolean {
        if (iconRe.test(node.nodeMarkdown)) {
            const res:RegExpExecArray = iconRe.exec(node.nodeMarkdown);
            if (node.icon) {
                config.addIcon(new IconConfigItem(res[1], node.icon[0].$['BUILTIN']));
            }
        }
        return false;
    });
    return config;
}

export function parseTasks(file:MapContent) {
    const taskRex:RegExp = /^\*(.*)/;

    const config:IconConfig = parseConfig(file);
    file.recurseNodes(function (node:MapNode):boolean {
        if (taskRex.test(node.nodeMarkdown) || node.hasIcon(config.configToIcon('Task'))) {
            const newTask = nodeToTask(node, config);
            const taskIcon = config.configToIcon("task");
            node.nodeMarkdown = newTask.description;
            if (!node.hasIcon(taskIcon)) {
                node.addIcon(taskIcon);
            }
            if (newTask.context) {
                node.removeAttribute('Where');
                node.addAttribute("Where", newTask.context.join(','));
                for (let j = 0; j < newTask.context.length; j++) {
                    const curContext:string = newTask.context[j];
                    const curIcon:string = config.configToIcon("@" + curContext);
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
