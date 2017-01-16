#!/usr/bin/env node

var Cli = require('../lib/cli.js');
var commander = require('commander');

Promise.resolve()
    .then(() => {
        commander.version(require('../package.json').version)
            .option('-p --port [integer]', 'HTTP port')
            .option('-b --bind [string]', 'HTTP bind')
            .option('-c --config [path]', 'Config file')
            .option('-d --debug', 'Enable debug')
            .parse(process.argv);
    })
    .then(() => commander.args.length && Promise.reject(new Error('Please use pathifier --help to see the usage.'))) // eslint-disable-line no-console
    .then(() => Cli.execute({
        port: commander.port,
        bind: commander.bind,
        config: commander.config
    }))
    .catch((error) => {
        if (commander.debug) {
            if (error.stack) {
                for (var line of error.stack.split('\n')) {
                    console.error(line); // eslint-disable-line no-console
                }
            }
        } else {
            console.error(error.message); // eslint-disable-line no-console
        }

        process.exit(1);
    });
