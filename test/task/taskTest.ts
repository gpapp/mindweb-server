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


describe('FileHelper node parse', function () {
    var userId1;
    var testFile1Raw:Buffer;
    var testFile2Raw:Buffer;
    var testFile1:FileContent;
    var testFile2:FileContent;
    var fileService = new FileService(cassandraClient);
    var userService = new UserService(cassandraClient);
    before(function (next) {
        fs.readFile("test/task/tasktest1.mm", function (err, data:Buffer) {
            if (err) {
                console.error("Could not create file", err);
            }
            testFile1Raw = data;
            ConverterHelper.fromFreeplane(data, function (error:ServiceError, result:FileContent) {
                if (error) {
                    console.error("Could not create file", error);
                    next();
                }
                else {
                    testFile1 = result;
                    next();
                }
            })

        });
    });
    before(function (next) {
        fs.readFile("test/task/tasktest2.mm", function (err, data:Buffer) {
            if (err) {
                console.error("Could not create file", err);
            }
            testFile2Raw = data;
            ConverterHelper.fromFreeplane(data, function (error:ServiceError, result:FileContent) {
                if (error) {
                    console.error("Could not create file", error);
                    next();
                }
                else {
                    testFile2 = result;
                    next();
                }
            })

        });
    });
    it("Parses an empty map for config", function (done) {
        TaskHelper.parseTasks(testFile1);
        ConverterHelper.fromFreeplane(testFile1Raw, function (error:ServiceError, result:FileContent) {
            result.recurseNodes(function (node:MapNode):boolean {
                var origNode:MapNode = testFile2.findNodeById(node.$['ID']);
                assert.equal(origNode.detailMarkdown, node.detailMarkdown);
                assert.equal(origNode.icon ? origNode.icon.length : -1, node.icon ? node.icon.length : -1);
                return false;
            });
            done();
        })

    });
    it("Parses an example map for tasks", function (done) {
        TaskHelper.parseTasks(testFile2);
        ConverterHelper.fromFreeplane(testFile2Raw, function (error:ServiceError, testFileOrig:FileContent) {
            testFileOrig.recurseNodes(function (node:MapNode):boolean {
                var nodeId = node.$['ID'];
                var origNode:MapNode = testFile2.findNodeById(nodeId);
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
            var testNodeOrig:MapNode;
            testNodeNew = testFile2.findNodeById('ID_825572237');
            testNodeOrig = testFileOrig.findNodeById('ID_825572237');
            assert(testNodeNew.hasIcon('yes'));
            assert.equal("Create web based mindmap editor for Freeplane with the same functionality", testNodeNew.nodeMarkdown);
            assert.equal('Someday', testNodeNew.getAttribute('When'));
            assert.equal('Computer,Hobby', testNodeNew.getAttribute('Where'));
            done();
        });
    });
})
;
