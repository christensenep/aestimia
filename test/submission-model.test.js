var _ = require('underscore');
var async = require('async');
var should = require('should');
var sinon = require('sinon');

var db = require('./db');
var baseSubmission = require('./utils').baseSubmission;
var models = require('../').models;
var Submission = models.Submission;
var Mentor = models.Mentor;

function ensureInvalid(invalidator) {
  return function(done) {
    var attrs = baseSubmission(invalidator);
    async.series([
      db.removeAll(Submission),
      db.create(Submission, attrs)
    ], function(err) {
      err.name.should.eql('ValidationError');
      done();
    });    
  };
}

db.init();

describe('Submission', function() {
  it('should propagate errors in reviewer validation', function(done) {
    sinon.stub(Submission.Mentor, 'classificationsFor', function(who, cb) {
      cb(new Error("oof"));
    });
    async.series([
      db.removeAll(Submission),
      db.create(Submission, baseSubmission({reviewer: "foo@bar.org"}))
    ], function(err) {
      Submission.Mentor.classificationsFor.restore();
      err.message.should.eql("oof");
      done();
    });
  });

  it('should accept reviewers with proper permissions', function(done) {
    async.series([
      db.removeAll(Submission),
      db.removeAll(Mentor),
      db.create(Mentor, {email: "foo@bar.org",
                         classifications: ["math"]}),
      db.create(Submission, baseSubmission({reviewer: "foo@bar.org"}))
    ], done);
  });

  it('should reject reviewers without proper permissions', function(done) {
    async.series([
      db.removeAll(Submission),
      db.removeAll(Mentor),
      db.create(Submission, baseSubmission({reviewer: "foo@bar.org"}))
    ], function(err) {
      err.name.should.eql("ValidationError");
      err.errors.reviewer.message
        .should.eql("reviewer does not have permission to review");
      done();
    });
  });

  it('should reject unsafe urls for evidence', ensureInvalid(function(attrs) {
    attrs.evidence[1].url = "javascript:lol()";
  }));

  it('should reject unsafe urls for criteria', ensureInvalid(function(attrs) {
    attrs.criteriaUrl = "javascript:lol()";
  }));

  it('should reject unsafe urls for image', ensureInvalid(function(attrs) {
    attrs.achievement.imageUrl = "javascript:lol()";
  }));

  it('should work with canned responses', function(done) {
    async.series([
      db.removeAll(Submission),
      function(cb) {
        var s = new Submission(baseSubmission({
          cannedResponses: [
            "This is awesome",
            "This kind of sucks",
            "You didn't satisfy all criteria"
          ],
        }));
        s.isLearnerUnderage().should.eql(true);
        s.save(cb);
      }
    ], done);
  });

  it('should work without canned responses', function(done) {
    async.series([
      db.removeAll(Submission),
      function(cb) {
        var s = new Submission(baseSubmission());
        s.isLearnerUnderage().should.eql(false);
        s.save(cb);
      }
    ], done);
  });
});
