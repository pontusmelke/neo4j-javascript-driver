/**
 * Copyright (c) 2002-2015 "Neo Technology,"
 * Network Engine for Objects in Lund AB [http://neotechnology.com]
 *
 * This file is part of Neo4j.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import StreamObserver from './internal/stream-observer';
import {Result} from './result';

/**
 * A Session instance is used for handling the connection and
 * sending statements through the connection.
 * @access public
 */

class Transaction {
  /**
   * @constructor
   * @param {Connection} conn - A connection to use
   * @param {function()} onClose - Function to be called on connection close
   */
  constructor(conn, onClose) {
    this._conn = conn;
    this._sessionCb = onClose;
  }

  /**
   * Run Cypher statement
   * Could be called with a statement object i.e.: {statement: "MATCH ...", parameters: {param: 1}}
   * or with the statement and parameters as separate arguments.
   * @param {mixed} statement - Cypher statement to execute
   * @param {Object} parameters - Map with parameters to use in statement
   * @return {Result} - New Result
   */
  run(statement, parameters) {
    if (typeof statement === 'object' && statement.text) {
      parameters = statement.parameters || {};
      statement = statement.text;
    }
    let streamObserver = new StreamObserver();
    this._conn.run(statement, parameters || {}, streamObserver);
    this._conn.pullAll(streamObserver);
    this._conn.sync();
    return new Result(streamObserver, statement, parameters);
  }

  /**
   * Close connection
   * @param {function()} cb - Function to be called on connection close
   * @return
   */
  close(cb) {
    let observer = new TxCloseObserver(cb, this._sessionCb);
    this._conn.run("COMMIT", {}, observer);
    this._conn.pullAll(observer);
    this._conn.sync();
  }
}


class TxCloseObserver {
  constructor( userCb, sessionCb ) {
    this._userCb = userCb
    this._sessionCb = sessionCb;
  }

  onNext( ignore ) {}

  onCompleted( meta ) {
    this._sessionCb();
    this._userCb.onCompleted( meta );
  }

  onError( error ) {
    this._sessionCb();
    this._userCb.onError( error );
  }
}

export default Transaction;


/*

 session.beginTransaction(cb1)

 conn.run("BEGIN")
 ...somehow wait for outcome..
 ...instantitate tx
 ...call cb

 cb1(transaction)

 tx.run = session.run

 tx.abort
 conn.run("ABORT")

 tx.close
 conn.run("COMMIT")
 .... call cb2
 */
