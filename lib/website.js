var Http = require('http');
var Https = require('https');
var Url = require('url');
var Jsdom = require('jsdom');
var _s = require('underscore.string');

class Website {
    constructor(options = {}) {
        if (!options.upstreamOrigin) throw new Error('upstreamOrigin is required for website.');
        var url = Url.parse(options.upstreamOrigin);
        if (!url.protocol.match(/^https?:$/)) throw new Error('only http or https protocol is supported in upstreamOrigin.');
        this.upstreamOptions = {
            protocol: url.protocol,
            hostname: url.hostname,
            port: url.port,
            auth: url.auth
        };

        if (!options.path && options.path !== '') throw new Error('path is required for website');
        if (options.path.match(/\/$/)) throw new Error('trailing slash is not need in path');
        this.path = options.path;
    }

    match(url) {
        if (!url.startsWith(this.path)) return false;

        return true;
    }

    transformHeaders(rawHeaders) {
        var headers = {};
        for (var rawName in rawHeaders) {
            var name = rawName.replace(
                /\w+\W*/g,
                match => _s(match).titleize().value()
            );
            headers[name] = rawHeaders[rawName];
            if (headers[name].constructor === Array) headers[name] = headers[name].join(',');
        }
        return headers;
    }

    handleRequest(request, response) {
        var path = request.url.substring(this.path.length);

        if (path == '') {
            response.writeHead(
                302, {
                    Location: this.path + '/'
                }
            );
            return response.end();
        }

        var requestHeaders = this.transformHeaders(request.headers);
        var requestHost = requestHeaders['Host'];
        var requestAddress = request.socket.remoteAddress;
        var requestPort = request.socket.remotePort;
        var requestType = requestHeaders['Accept'] || 'text/html';

        // Set Header
        requestHeaders['X-Forwarded-Host'] = requestHeaders['X-Forwarded-Host'] || requestHost;
        if (requestHeaders['X-Forwarded-For']) {
            requestHeaders['X-Forwarded-For'] += ', ' + requestAddress;
        } else {
            requestHeaders['X-Forwarded-For'] = requestAddress;
        }
        requestHeaders['X-Real-Ip'] = requestHeaders['X-Real-Ip'] || requestAddress;
        requestHeaders['X-Client-Ip'] = requestHeaders['X-Client-Ip'] || requestAddress;
        requestHeaders['X-Forwarded-Proto'] = requestHeaders['X-Forwarded-Proto'] || 'http';
        requestHeaders['X-Forwarded-Scheme'] = requestHeaders['X-Forwarded-Scheme'] || 'http';
        requestHeaders['X-Forwarded-Port'] = requestHeaders['X-Forwarded-Port'] || requestPort;

        if (requestType.match(/^text\/(css|html)/)) delete requestHeaders['Accept-Encoding'];
        if (this.upstreamOptions.hostname) delete requestHeaders['Host'];

        var upstreamRequest = (this.upstreamOptions.protocol == 'http:' ? Http : Https)
            .request({
                method: request.method,
                protocol: this.upstreamOptions.protocol,
                path: path,
                hostname: this.upstreamOptions.hostname,
                port: this.upstreamOptions.port,
                auth: this.upstreamOptions.auth,
                headers: requestHeaders
            });

        upstreamRequest.on('response', (upstreamResponse) => {
            var responseHeaders = this.transformHeaders(upstreamResponse.headers);

            // Transform Location
            if (responseHeaders['Location']) {
                responseHeaders['Location'] = this.transformUrl(responseHeaders['Location'], requestHost);
            }
            delete responseHeaders['Connection'];

            // Extract MimeType
            var contentType = responseHeaders['Content-Type'] || 'text/plain';
            contentType = contentType.replace(/\;\s*([^\;]+)=([^\;]+)/g, () => {
                return '';
            }).toLowerCase();

            if (contentType.match(/^text\//) && !responseHeaders['Content-Encoding']) {
                var content = '';
                upstreamResponse.setEncoding('utf8');
                upstreamResponse.on('data', (chunk) => {
                    content += chunk;
                });

                upstreamResponse.on('end', () => {
                    this.transformText(content, contentType)
                        .catch(() => {
                            return Promise.resolve(content);
                        })
                        .then(content => {
                            if (responseHeaders['Content-Length']) {
                                responseHeaders['Content-Length'] = content.length.toString();
                            }

                            response.writeHead(
                                upstreamResponse.statusCode,
                                upstreamResponse.statusMessage,
                                responseHeaders
                            );

                            response.end(content);
                        });
                });

                upstreamResponse.resume();
            } else {
                response.writeHead(
                    upstreamResponse.statusCode,
                    upstreamResponse.statusMessage,
                    responseHeaders
                );

                upstreamResponse.pipe(response);
                upstreamResponse.resume();
            }
        });

        upstreamRequest.on('error', (error) => {
            response.writeHead(
                502,
                'Upstream Not Available'
            );

            response.end('Error requesting upstream: ' + error.message);
        });

        request.pipe(upstreamRequest);
        request.resume();
    }

    // Transform website's path to mounted path
    //
    // @param href: path specified in upstream website, e.g: /assets/application-xxx.js
    // @return mounted path, e.g: /app1/assets/application-xxx.js
    //
    transformPath(href) {
        if (href.match(/^\/[^\/]/)) return this.path + href;

        return href;
    }

    // Transform url in upstream to mounted url
    //
    // @param urlString: url generated by upstream website, e.g: http://127.0.0.1:3000/login
    // @param host: url mapped to mounted site, e.g: http://boost.co.nz/app1/login
    // @return transformed url
    //
    transformUrl(urlString, host) {
        var url = Url.parse(urlString);

        if (url.protocol == this.upstreamOptions.protocol ||
            url.hostname == this.upstreamOptions.hostname ||
            url.port == this.upstreamOptions.port ||
            url.auth == this.upstreamOptions.auth) {
            urlString = Url.format({
                protocol: 'http:',
                host: host,
                pathname: this.path + url.pathname,
                search: url.search,
                hash: url.hash
            });
        }

        return urlString;
    }

    // Transform text response if neccessary
    //
    // @param content: text content
    // @param contentType: MimeType of the response
    // @return Promise resolved with the transformed text
    //
    transformText(content, contentType) {
        return Promise.resolve()
            .then(() => {
                if (!this.path) {
                    return content;
                }

                if (contentType == 'text/html') {
                    return this.transformHTML(content);
                }

                if (contentType == 'text/css') {
                    return this.transformCSS(content);
                }

                return content;
            });
    }

    // Transform HTML response
    //
    // @param html: HTML source
    // @return Promise resolved with transformed HTML
    //
    transformHTML(html) {
        return new Promise((resolve, reject) => {
            Jsdom.env({
                html: html,
                done: (error, window) => {
                    var element;
                    if (error) return reject(error);

                    for (element of window.document.querySelectorAll('[href]')) {
                        element.setAttribute('href', this.transformPath(element.getAttribute('href')));
                    }

                    for (element of window.document.querySelectorAll('[src]')) {
                        element.setAttribute('src', this.transformPath(element.getAttribute('src')));
                    }

                    for (element of window.document.querySelectorAll('[action]')) {
                        element.setAttribute('action', this.transformPath(element.getAttribute('action')));
                    }

                    resolve(window.document.documentElement.outerHTML);
                }
            });
        });
    }

    // Transform CSS response
    //
    // @param css: CSS source
    // @return transformed CSS
    //
    transformCSS(css) {
        return css.replace(
            /url\([\'\"]?([^\'\"\)]+)[\'\"]?\)/g,
            (match, url) => 'url("' + this.transformPath(url) + '")'
        );
    }
}

module.exports = Website;
