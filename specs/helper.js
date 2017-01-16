var chai = require('chai');
var sinon = require('sinon');
var sinnoChai = require('sinon-chai');

chai.use(sinnoChai);
var sandbox = sinon.sandbox.create();
var expect = chai.expect;

module.exports = {
    sandbox,
    expect
};
