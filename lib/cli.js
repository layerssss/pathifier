var fs = require('fs');
var assert = require('assert');
var Server = require('./server.js');
var Website = require('./website.js');

class Cli {
    static execute(options) {
        if (!options.config) return Promise.reject(new Error('Must specify a config file.'));
        var config = JSON.parse(fs.readFileSync(options.config, 'utf8'));

        assert(config.websites, 'websites is required.');
        assert(config.websites.constructor === Array, 'websites should be an array.');

        var server = new Server();

        for (var websiteConfig of config.websites) {
            var website = new Website({
                hostname: websiteConfig.hostname,
                upstreamOrigin: websiteConfig.upstreamOrigin,
                path: websiteConfig.path || ''
            });

            server.websites.push(website);
        }

        return server.listen(
                options.port || process.env['PORT'] || 8000,
                options.bind || 'localhost'
            )
            .then((server) => {
                var address = server.address();
                console.log('pathifier listening to http://' + address.address + ':' + address.port); // eslint-disable-line no-console
            });
    }
}

module.exports = Cli;
