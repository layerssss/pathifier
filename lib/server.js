var Http = require('http');

class Server {
    constructor() {
        this.websites = [];
    }

    handleRequest(request, response) {
        var websitesReversed = [...this.websites];
        websitesReversed.reverse();
        for (var website of websitesReversed) {
            if (website.match(request.url)) {
                return website.handleRequest(request, response);
            }
        }

        response.writeHead('404', 'No website found.');
        response.end('No website found.');
    }

    listen(port, bind) {
        var server = Http.createServer((request, response) => {
            this.handleRequest(request, response);
        });
        return new Promise((resolve, reject) => {
            server.on('error', reject);
            server.on('listening', () => resolve(server));
            server.listen(port, bind);
        });
    }
}

module.exports = Server;
