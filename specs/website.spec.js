describe('Website', () => {
    var helper = require('./helper.js');
    var Website = require('../lib/website.js');

    beforeEach(() => {
        helper.sandbox.restore();
    });

    describe('given a website', () => {
        var website;

        beforeEach(() => {
            website = new Website({
                upstreamOrigin: 'http://localhost:3000',
                path: '/app1'
            });
        });

        describe('constructor', () => {
            it('should assign the attributes', () => {
                helper.expect(website.upstreamOptions).to.deep.eq({
                    auth: null,
                    protocol: 'http:',
                    hostname: 'localhost',
                    port: '3000'
                });
                helper.expect(website.path).to.eq('/app1');
            });
        });

        describe('match', () => {
            it('should return false for un-matched path', () => {
                helper.expect(website.match('/')).to.be.false;
            });

            it('should return true for matched request', () => {
                helper.expect(website.match('/app1/page.html')).to.be.true;
            });
        });

        describe('proxyRequest', () => {
        });

        describe('transformText', () => {
        });
    });
});
