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

var neo4j = require("../lib/neo4j-api-v1");
var StatementType = require("../lib/result-summary").statementType;

describe('session', function() {
  it('should expose basic run/subscribe ', function(done) {
    // Given
    var driver = neo4j.driver("bolt://localhost");

    // When & Then
    var records = [];
    driver.session().run( "RETURN 1.0 AS a").subscribe( {
      onNext : function( record ) {
        records.push( record );
      },
      onCompleted : function( ) {
        expect( records.length ).toBe( 1 );
        expect( records[0]['a'] ).toBe( 1 );
        driver.close();
        done();
      }
    });
  });

  it('should keep context in subscribe methods ', function(done) {
    // Given
    var driver = neo4j.driver("bolt://localhost");
    function myObserver(){
      this.local = 'hello';
      var privateLocal = 'hello';
      this.onNext = function() {
        expect(privateLocal).toBe('hello');
        expect(this.local).toBe('hello');
      };
      this.onCompleted = function() {
        expect(privateLocal).toBe('hello');
        expect(this.local).toBe('hello');
        driver.close();
        done();
      }
    }

    // When & Then
    driver.session().run( "RETURN 1.0 AS a").subscribe(new myObserver());
  });

  it('should call observers onError on error ', function(done) {
    // Given
    var driver = neo4j.driver("bolt://localhost");

    // When & Then
    var records = [];
    driver.session().run( "RETURN 1 AS").subscribe( {
      onError: function(error) {
        expect(error.fields.length).toBe(1);
        driver.close();
        done();
      }
    });
  });

  it('should accept a statement object ', function(done) {
    // Given
    var driver = neo4j.driver("bolt://localhost");
    var statement = {text: "RETURN 1 = {param} AS a", parameters: {param: 1}};

    // When & Then
    var records = [];
    driver.session().run( statement ).subscribe( {
      onNext : function( record ) {
        records.push( record );
      },
      onCompleted : function( ) {
        expect( records.length ).toBe( 1 );
        expect( records[0]['a'] ).toBe( true );
        driver.close();
        done();
      }
    });
  });

  it('should expose basic run/then/then/then ', function(done) {
    // Given
    var driver = neo4j.driver("bolt://localhost");
    // When & Then
    driver.session().run( "RETURN 1.0 AS a")
    .then(
      function( records ) {
        expect( records.length ).toBe( 1 );
        expect( records[0]['a'] ).toBe( 1 );
      }
    ).then(
      function(records) {
        expect( records.length ).toBe( 1 );
        expect( records[0]['a'] ).toBe( 1 );
      }
    ).then( function() { driver.close(); done(); })
  });

  it('should expose basic run/catch ', function(done) {
    // Given
    var driver = neo4j.driver("bolt://localhost");
    // When & Then
    driver.session().run( "RETURN 1 AS").catch(
      function(error) {
        expect( error.fields.length).toBe(1);
        driver.close();
        done();
      }
    )
  });

  it('should expose summarize method for basic metadata ', function(done) {
    // Given
    var driver = neo4j.driver("bolt://localhost");
    var statement = "CREATE (n:Label {prop:{prop}}) RETURN n";
    var params = {prop: "string"}
    // When & Then
    var result = driver.session().run( statement, params );
    result.then(function( records ) {
      var sum = result.summarize();
      expect(sum.statement.text).toBe( statement );
      expect(sum.statement.parameters).toBe( params );
      expect(sum.updateStatistics.containsUpdates()).toBe(true);
      expect(sum.updateStatistics.nodesCreated()).toBe(1);
      expect(sum.statementType).toBe(StatementType.READ_WRITE);
      driver.close();
      done();
    });
  });

  it('should expose plan ', function(done) {
    // Given
    var driver = neo4j.driver("bolt://localhost");
    var statement = "EXPLAIN CREATE (n:Label {prop:{prop}}) RETURN n";
    var params = {prop: "string"}
    // When & Then
    var result = driver.session().run( statement, params );
    result.then(function( records ) {
      var sum = result.summarize();
      expect(sum.hasPlan()).toBe(true);
      expect(sum.hasProfile()).toBe(false);
      expect(sum.plan.operatorType).toBe('ProduceResults');
      expect(sum.plan.arguments.runtime).toBe('INTERPRETED');
      expect(sum.plan.identifiers[0]).toBe('n');
      expect(sum.plan.children[0].operatorType).toBe('CreateNode');
      driver.close();
      done();
    });
  });

  it('should expose profile ', function(done) {
    // Given
    var driver = neo4j.driver("bolt://localhost");
    var statement = "PROFILE MATCH (n:Label {prop:{prop}}) RETURN n";
    var params = {prop: "string"}
    // When & Then
    var result = driver.session().run( statement, params );
    result.then(function( records ) {
      var sum = result.summarize();
      expect(sum.hasPlan()).toBe(true); //When there's a profile, there's a plan
      expect(sum.hasProfile()).toBe(true);
      expect(sum.profile.operatorType).toBe('ProduceResults');
      expect(sum.profile.arguments.runtime).toBe('INTERPRETED');
      expect(sum.profile.identifiers[0]).toBe('n');
      expect(sum.profile.children[0].operatorType).toBe('Filter');
      expect(sum.profile.rows).toBeGreaterThan(0);
      //expect(sum.profile.dbHits).toBeGreaterThan(0);
      driver.close();
      done();
    });
  });

  it('should expose cypher notifications ', function(done) {
    // Given
    var driver = neo4j.driver("bolt://localhost");
    var statement = "EXPLAIN MATCH (n), (m) RETURN n, m";
    // When & Then
    var result = driver.session().run( statement );
    result.then(function( records ) {
      var sum = result.summarize();
      expect(sum.notifications.length).toBeGreaterThan(0);
      expect(sum.notifications[0].code).toBe("Neo.ClientNotification.Statement.CartesianProduct");
      expect(sum.notifications[0].title).toBe("This query builds a cartesian product between disconnected patterns.");
      expect(sum.notifications[0].position.column).toBeGreaterThan(0);
      driver.close();
      done();
    });
  });
});
