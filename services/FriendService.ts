import * as async from 'async';
import * as cassandra from 'cassandra-driver';

import Friend from '../classes/Friend';
import User from '../classes/User';
import ServiceError from "../classes/ServiceError";

import FriendDAO from '../dao/Friend';

var Uuid = require('cassandra-driver').types.Uuid;

export default class FriendService {
    private friend:FriendDAO;

    constructor(connection) {
        this.friend = new FriendDAO(connection);
    }
}