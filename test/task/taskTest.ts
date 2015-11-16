/// <reference path="../../typings/tsd.d.ts" />
import * as mocha from 'mocha';
import * as chai from 'chai';
import * as async from 'async';
import * as cassandra from 'cassandra-driver';

import * as fs from 'fs';
import File from "../../classes/File";
import FileService from '../../services/FileService';
import UserService from '../../services/UserService';
import * as TaskHelper from '../../services/TaskHelper';
import * as ConverterHelper from '../../services/ConverterHelper';
import ServiceError from "../../classes/ServiceError";
import MapNode from "../../classes/MapNode";
import FileContent from "../../classes/FileContent";

var assert = chai.assert;
var rawConfig = fs.readFileSync('config/config.json');
var config = rawConfig.toString();

for (var key in process.env) {
    if (!process.env.hasOwnProperty(key)) {
        continue;
    }
    var re = new RegExp('\\$\\{' + key + '\\}', 'g');
    config = config.replace(re, process.env[key]);
}
var options = JSON.parse(config);

console.log('Expecting DB on ' + options.db.host + ':' + options.db.port);

var cassandraClient = new cassandra.Client({
    contactPoints: [
        options.db.host
    ],
    protocolOptions: {
        port: options.db.port
    }
});

cassandraClient.connect(function (error) {
    if (error) {
        throw 'Cannot connect to database';
    }
    console.log('Connected to database');
});


describe('FileHelper node empty map parse', function () {
    var testFileRaw:Buffer;
    var testFile:FileContent;
    before(function (next) {
        fs.readFile("test/task/tasktest1.mm", function (err, data:Buffer) {
            if (err) {
                console.error("Could not create file", err);
            }
            testFileRaw = data;
            ConverterHelper.fromFreeplane(data, function (error:ServiceError, result:FileContent) {
                if (error) {
                    console.error("Could not create file", error);
                    next();
                }
                else {
                    testFile = result;
                    next();
                }
            })

        });
    });
    it("Parses an empty map for config", function (done) {
        TaskHelper.parseTasks(testFile);
        ConverterHelper.fromFreeplane(testFileRaw, function (error:ServiceError, result:FileContent) {
            result.recurseNodes(function (node:MapNode):boolean {
                var origNode:MapNode = testFile.findNodeById(node.$['ID']);
                assert.equal(origNode.detailMarkdown, node.detailMarkdown);
                assert.equal(origNode.icon ? origNode.icon.length : -1, node.icon ? node.icon.length : -1);
                return false;
            });
            done();
        })
    });
});

describe('FileHelper node simple parse', function () {
    var testFileRaw:Buffer;
    var testFile:FileContent;
    before(function (next) {
        fs.readFile("test/task/tasktest2.mm", function (err, data:Buffer) {
            if (err) {
                console.error("Could not create file", err);
            }
            testFileRaw = data;
            ConverterHelper.fromFreeplane(data, function (error:ServiceError, result:FileContent) {
                if (error) {
                    console.error("Could not create file", error);
                    next();
                }
                else {
                    testFile = result;
                    next();
                }
            })

        });
    });
    it("Parses an example map for tasks", function (done) {
        TaskHelper.parseTasks(testFile);
        ConverterHelper.fromFreeplane(testFileRaw, function (error:ServiceError, testFileOrig:FileContent) {
            testFileOrig.recurseNodes(function (node:MapNode):boolean {
                var nodeId = node.$['ID'];
                var origNode:MapNode = testFile.findNodeById(nodeId);
                if (['ID_825572237',
                        'ID_805969038', 'ID_1460792926', 'ID_972517531', 'ID_391734240',
                        'ID_1916348085', 'ID_1190980308', 'ID_1900184887', 'ID_759486144',
                        'ID_1236162794', 'ID_1561371231'
                    ].indexOf(nodeId) < 0) {
                    assert.equal(origNode.nodeMarkdown, node.nodeMarkdown, "" + nodeId);
                    assert.equal(origNode.detailMarkdown, node.detailMarkdown, "" + nodeId);
                    assert.equal(origNode.icon ? origNode.icon.length : -1, node.icon ? node.icon.length : -1, "" + nodeId);
                }
                return false;
            });
            var testNodeNew:MapNode;
            testNodeNew = testFile.findNodeById('ID_825572237');
            assert(testNodeNew.hasIcon('yes'));
            assert(testNodeNew.hasIcon('male1'));
            assert.equal(testNodeNew.nodeMarkdown, "Create web based mindmap editor for Freeplane with the same functionality");
            assert.equal(testNodeNew.getAttribute('When'), 'Someday');
            assert.equal(testNodeNew.getAttribute('Where'), 'Computer,Hobby');

            testNodeNew = testFile.findNodeById('ID_805969038');
            assert(testNodeNew.hasIcon('yes'));
            assert(testNodeNew.hasIcon('male1'));
            assert.equal(testNodeNew.nodeMarkdown, "Create cloud synchronization feature for Freeplane");
            assert.equal(testNodeNew.getAttribute('When'), 'Someday');
            assert.equal(testNodeNew.getAttribute('Where'), 'Computer,Hobby');

            testNodeNew = testFile.findNodeById('ID_1460792926');
            assert(testNodeNew.hasIcon('yes'));
            assert.equal(testNodeNew.nodeMarkdown, "Create Freeplane Android client");
            assert.isNull(testNodeNew.getAttribute('When'));
            assert.isNull(testNodeNew.getAttribute('Where'));

            testNodeNew = testFile.findNodeById('ID_972517531');
            assert(testNodeNew.hasIcon('yes'));
            assert.equal(testNodeNew.nodeMarkdown, "Improve presentation skills");
            assert.equal(testNodeNew.getAttribute('When'), 'Someday');
            assert.isNull(testNodeNew.getAttribute('Where'));

            testNodeNew = testFile.findNodeById('ID_391734240');
            assert(testNodeNew.hasIcon('yes'));
            assert.equal(testNodeNew.nodeMarkdown, "Learn to write Android applications");
            assert.equal(testNodeNew.getAttribute('When'), 'Someday');
            assert.isNull(testNodeNew.getAttribute('Where'));

            testNodeNew = testFile.findNodeById('ID_1916348085');
            assert(testNodeNew.hasIcon('yes'));
            assert(testNodeNew.hasIcon('male1'));
            assert(testNodeNew.hasIcon('gohome'));
            assert.equal(testNodeNew.nodeMarkdown, "Must create GTD presentation");
            assert.equal(testNodeNew.getAttribute('When'), '03.24');
            assert.equal(testNodeNew.getAttribute('Where'), 'Home,Computer');
            assert.equal(testNodeNew.getAttribute('Who'), 'Papp Gergely');

            testNodeNew = testFile.findNodeById('ID_1190980308');
            assert(testNodeNew.hasIcon('yes'));
            assert(testNodeNew.hasIcon('gohome'));
            assert.equal(testNodeNew.nodeMarkdown, "Buy dog food");
            assert.isNull(testNodeNew.getAttribute('When'));
            assert.equal(testNodeNew.getAttribute('Where'), 'Home,Shop');

            testNodeNew = testFile.findNodeById('ID_1900184887');
            assert(testNodeNew.hasIcon('yes'));
            assert(testNodeNew.hasIcon('group'));
            assert.equal(testNodeNew.nodeMarkdown, "Spend hours with HPC");
            assert.equal(testNodeNew.getAttribute('When'), '4.1');
            assert.equal(testNodeNew.getAttribute('Where'), 'Meeting');
            assert.equal(testNodeNew.getAttribute('Who'), 'Dogbert');

            testNodeNew = testFile.findNodeById('ID_759486144');
            assert(testNodeNew.hasIcon('yes'));
            assert.equal(testNodeNew.nodeMarkdown, "Talk to boss about a raise");
            assert.isNull(testNodeNew.getAttribute('Where'));
            assert.equal(testNodeNew.getAttribute('When'), '4.1');
            assert.equal(testNodeNew.getAttribute('Who'), 'Pointy Haired Boss');

            testNodeNew = testFile.findNodeById('ID_1236162794');
            assert(testNodeNew.hasIcon('yes'));
            assert(testNodeNew.hasIcon('Mail'));
            assert.equal(testNodeNew.nodeMarkdown, "Reply to consultant\'s QA assessment");
            assert.isNull(testNodeNew.getAttribute('When'));
            assert.equal(testNodeNew.getAttribute('Where'), 'email');
            assert.equal(testNodeNew.getAttribute('Who'), 'Dogbert');

            testNodeNew = testFile.findNodeById('ID_1561371231');
            assert(testNodeNew.hasIcon('male1'));
            assert(testNodeNew.hasIcon('yes'));
            assert.equal(testNodeNew.nodeMarkdown, "Archive competed tasks with structures");
            assert.equal(testNodeNew.getAttribute('When'), 'Later');
            assert.equal(testNodeNew.getAttribute('Where'), 'Computer,Hobby');
            assert.equal(testNodeNew.getAttribute('Who'), 'Papp Gergely');

            done();
        });
    });
});

describe('FileHelper node cornercases parse', function () {
    var testFileRaw:Buffer;
    var testFile:FileContent;
    before(function (next) {
        fs.readFile("test/task/tasktest3.mm", function (err, data:Buffer) {
            if (err) {
                console.error("Could not create file", err);
            }
            testFileRaw = data;
            ConverterHelper.fromFreeplane(data, function (error:ServiceError, result:FileContent) {
                if (error) {
                    console.error("Could not create file", error);
                    next();
                }
                else {
                    testFile = result;
                    next();
                }
            })

        });
    });
     it("Parses a map with corner cases for tasks", function (done) {
        TaskHelper.parseTasks(testFile);
        ConverterHelper.fromFreeplane(testFileRaw, function (error:ServiceError, testFileOrig:FileContent) {
            testFileOrig.recurseNodes(function (node:MapNode):boolean {
                var nodeId = node.$['ID'];
                var origNode:MapNode = testFile.findNodeById(nodeId);
                if (['ID_1976506990','ID_1221496068','ID_254804742','ID_875861497','ID_1546734060','ID_1166725155','ID_17589400'].indexOf(nodeId) < 0) {
                    assert.equal(origNode.nodeMarkdown, node.nodeMarkdown, "" + nodeId);
                    assert.equal(origNode.detailMarkdown, node.detailMarkdown, "" + nodeId);
                    assert.equal(origNode.icon ? origNode.icon.length : -1, node.icon ? node.icon.length : -1, "" + nodeId);
                }
                return false;
            });
            var testNodeNew:MapNode;
            testNodeNew = testFile.findNodeById('ID_1976506990');
            assert(testNodeNew.hasIcon('ksmiletris'));
            assert.equal(testNodeNew.nodeMarkdown, "Just 2");
            assert.equal(testNodeNew.getAttribute('Priority'), '1');
            assert.equal(testNodeNew.getAttribute('When'), '5minutes');
            assert.equal(testNodeNew.getAttribute('Where'), 'Meeing,Hell');
            assert.equal(testNodeNew.getAttribute('Who'), 'Dogbert');

            testNodeNew = testFile.findNodeById('ID_1221496068');
            assert(testNodeNew.hasIcon('ksmiletris'));
            assert(testNodeNew.hasIcon('group'));
            assert.equal(testNodeNew.nodeMarkdown, "1 Just 2");
            assert.equal(testNodeNew.getAttribute('Priority'), '4');
            assert.equal(testNodeNew.getAttribute('When'), '5minutes');
            assert.equal(testNodeNew.getAttribute('Where'), 'Meeting,Hell');
            assert.equal(testNodeNew.getAttribute('Who'), 'Catbert');

            testNodeNew = testFile.findNodeById('ID_254804742');
            assert(testNodeNew.hasIcon('ksmiletris'));
            assert.equal(testNodeNew.nodeMarkdown, "This Will be wrong");
            assert.equal(testNodeNew.getAttribute('Priority'), '1');
            assert.equal(testNodeNew.getAttribute('When'), 'today');
            assert.equal(testNodeNew.getAttribute('Where'), 'Context');
            assert.isNull(testNodeNew.getAttribute('Who'));

            testNodeNew = testFile.findNodeById('ID_875861497');
            assert(testNodeNew.hasIcon('ksmiletris'));
            assert.equal(testNodeNew.nodeMarkdown, "This should be converted to task with two contexts");
            assert.isNull(testNodeNew.getAttribute('Priority'));
            assert.isNull(testNodeNew.getAttribute('When'));
            assert.equal(testNodeNew.getAttribute('Where'), 'Meeting,Home');
            assert.isNull(testNodeNew.getAttribute('Who'));

            testNodeNew = testFile.findNodeById('ID_1546734060');
            assert(testNodeNew.hasIcon('ksmiletris'));
            assert.equal(testNodeNew.nodeMarkdown, "This should be converted to task with one context");
            assert.isNull(testNodeNew.getAttribute('Priority'));
            assert.isNull(testNodeNew.getAttribute('When'));
            assert.equal(testNodeNew.getAttribute('Where'), 'Home');
            assert.isNull(testNodeNew.getAttribute('Who'));

            testNodeNew = testFile.findNodeById('ID_1166725155');
            assert(testNodeNew.hasIcon('ksmiletris'));
            assert.equal(testNodeNew.nodeMarkdown, "This should be converted to task with three contexts");
            assert.isNull(testNodeNew.getAttribute('Priority'));
            assert.isNull(testNodeNew.getAttribute('When'));
            assert.equal(testNodeNew.getAttribute('Where'), 'LongFocus,Meeting,Home');
            assert.isNull(testNodeNew.getAttribute('Who'));

            testNodeNew = testFile.findNodeById('ID_17589400');
            assert(testNodeNew.hasIcon('ksmiletris'));
            assert.equal(testNodeNew.nodeMarkdown, "This should overwrite the already set date");
            assert.isNull(testNodeNew.getAttribute('Priority'));
            assert.equal(testNodeNew.getAttribute('When'),'now');
            assert.isNull(testNodeNew.getAttribute('Where'));
            assert.isNull(testNodeNew.getAttribute('Who'));
            done();
        });
    });
});
