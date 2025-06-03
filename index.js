// porkbun-client
// Copyright (C) 2025  Oxtaly

// // This program is free software: you can redistribute it and/or modify
// // it under the terms of the GNU General Public License as published by
// // the Free Software Foundation, either version 3 of the License, or
// // (at your option) any later version.

// // This program is distributed in the hope that it will be useful,
// // but WITHOUT ANY WARRANTY; without even the implied warranty of
// // MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// // GNU General Public License for more details.

// // You should have received a copy of the GNU General Public License
// // along with this program.  If not, see <https://www.gnu.org/licenses/>.

"use strict";

/**
 * @typedef {import('./types.d.ts').PorkbunAPIDNSRecordTypes} PorkbunAPIDNSRecordTypes
 * @typedef {import('./types.d.ts').PorkbunAPIRecordIDType}   PorkbunAPIRecordIDType
 * @typedef {import('./types.d.ts').PorkbunAPIResponses}      PorkbunAPIResponses
 * @typedef {import('./types.d.ts').PorkbunClientOptions}     PorkbunClientOptions
 * 
 * @typedef {import('./types.d.ts').PorkbunAPIDNSRecord}      PorkbunAPIDNSRecord
 * @typedef {import('./types.d.ts').PorkbunAPIStatuses}       PorkbunAPIStatuses
 */

/**
 * @template SuccessData
 * @typedef {import('./types.d.ts').PorkbunAPIResponse<SuccessData>} PorkbunAPIResponse
 */

/** Error thrown when the API does not respond as expected (eg: content-type is not set to application/json). */
class ResponseError extends Error {
    /** @type {{ url: string, body: Object }} */
    context = null;
    /** @type {Response} */
    response = null;
}

/** Error thrown when the API responds with a status of "ERROR". */
class APIError extends Error {
    /** @type {{ url: string, body: Object }} */
    context = null;
    /** @type {Object} */
    apiResponse = null;
}

/**
 * @param {string} url 
 * @returns 
 */
function isValidURL(url) {
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
}

class PorkbunClient {
    /** @private @readonly Internal version tracker. Incremented on behavior changes (including additions and deletions). */
    static get version() {
        return "7";
    } 

    /** @private @readonly @type {string} */
    _endpoint = `https://api.porkbun.com/api/json/v3`;
    /** @private @readonly @type {string} */
    _secretKey = null;
    /** @private @readonly @type {string} */
    _apiKey = null;
    /** @private @readonly @type {PorkbunClientOptions['queryLogger']} */
    _queryLogger = null;
    /** @private @readonly @type {string} */
    _userAgent = "porkbun-wrapper";

    /**
     * @param {PorkbunClientOptions} options 
     */
    constructor(options) {
        if(options === undefined)
            throw new TypeError('Missing options parameter!');
        if(typeof options !== 'object')
            throw new TypeError(`Invalid options parameter type! Expected 'object', received '${typeof options}'!`);

        if(options.apiKey === undefined)
            throw new TypeError('Missing options.apiKey parameter!');
        if(typeof options.apiKey !== 'string')
            throw new TypeError(`Invalid options.apiKey parameter type! Expected 'string', received '${typeof options.apiKey}'!`);
        this._apiKey = options.apiKey;
        
        if(options.secretKey === undefined)
            throw new TypeError('Missing options.secretKey parameter!');
        if(typeof options.secretKey !== 'string')
            throw new TypeError(`Invalid options.secretKey parameter type! Expected 'string', received '${typeof options.secretKey}'!`);
        this._secretKey = options.secretKey;

        if(options.userAgent !== undefined && options.userAgent !== null && typeof options.userAgent !== 'string')
            throw new TypeError(`Invalid options.userAgent parameter type! Expected 'null' | 'string', received '${options.userAgent}'!`);
        if(options.userAgent !== undefined)
            this._userAgent = options.userAgent;
        
        if(options.endpoint && typeof options.endpoint !== 'string')
            throw new TypeError(`Invalid options.endpoint parameter type! Expected 'string', received '${typeof options.endpoint}'!`);
        if(options.endpoint && !isValidURL(options.endpoint))
            throw new TypeError(`Invalid options.endpoint parameter value! Expected a valid URL, received '${options.endpoint}'!`);
        if(options.endpoint)
            this._endpoint = options.endpoint;
        if(this._endpoint.endsWith('/'))
            this._endpoint = this._endpoint.slice(0, -1);

        if(options.queryLogger && typeof options.queryLogger !== 'function')
            throw new TypeError(`Invalid options.logger parameter type! Expected 'function (query) => void', received '${typeof options.queryLogger}'!`);
        if(options.queryLogger)
            this._queryLogger = options.queryLogger;
    }

    /** 
     * Used internally to get the full endpoint URL for a given endpoint.
     * 
     * @private
     * @param {string} endpoint 
     */ 
    _getEndpoint(endpoint) {
        return this._endpoint + (endpoint.startsWith('/') ? endpoint : `/${endpoint}`);
    }

    /**
     * Used internally as a shortcut for requesting a post endpoint with the set credentials, along with handling the response.
     * 
     * @private
     * @param {Object} options
     * @param {string} options.url 
     * @param {any} [options.body]
     */
    _request(options) {
        return new Promise((resolve, reject) => {
            this._postRequest(options.url, options.body)
            .then((response) => this._responseHandler(resolve, reject, response, { url: options.url, body: options.body ?? {} }))
            .catch((error) => reject(error));
        });
    }

    /** 
     * Used internally to make a post request to a given url with the set credentials.
     * 
     * @private
     * @param {string} url 
     * @param {Object} body 
     */
    _postRequest(url, body) {
        if(!body) 
            body = {};
        
        if(this._queryLogger && typeof this._queryLogger === 'function') {
            if(body.secretapikey)
                delete body.secretapikey;
            if(body.apikey)
                delete body.apikey;
            this._queryLogger({ url, body });
        }

        body.secretapikey = this._secretKey;
        body.apikey = this._apiKey;

        const headers = {
            'accept': 'application/json',
            'content-type': 'application/json'
        }
        if(this._userAgent)
            headers['User-Agent'] = this._userAgent;

        return fetch(url, {
            headers,
            body: JSON.stringify(body),
            method: "POST"
        });
    }

    /**
     * Used internally to handle/check API responses before returning them.
     * 
     * @private
     * @param {(reason?: any) => void} reject 
     * @param {(value?: any) => void} resolve 
     * @param {Response} response 
     * @param {{ url: string, body: Object }} context 
     */
    async _responseHandler(resolve, reject, response, context) {
        if(response.headers.get('content-type') !== 'application/json') {
            const error = new ResponseError(`Invalid content type! Expected 'application/json', received '${response.headers.get('content-type')}'!`);
            error.response = response;
            error.context = context;
            reject(error);
            return;
        }

        const data = await response.text();
        try {
            const json = JSON.parse(data);
            if(!json.status) {
                const error = new ResponseError(`Missing response data.status! Expected 'SUCCESS' or 'ERROR', received '${json.status}'!`);
                error.response = response;
                error.context = context;
                return reject(error);
            }
            if(json.status !== 'SUCCESS' && json.status !== 'ERROR') {
                const error = new ResponseError(`Invalid response data.status! Expected 'SUCCESS' or 'ERROR', received '${json.status}'!`);
                error.response = response;
                error.context = context;
                return reject(error);
            }
            if(json.status === "ERROR") {
                const message = json.message || "The API responded with an error but did not provide a message!";
                const error = new APIError(message);
                error.apiResponse = json;
                error.context = context;
                return reject(error);
            }
            return resolve(json);
        } catch (caughtError) {
            const error = new ResponseError(`An error happened parsing response JSON!`);
            error.cause = caughtError;
            error.response = response;
            error.context = context;
            return reject(error);
        }
    }

    /**
     * Check default domain pricing information for all supported TLDs. This endpoint does not require authentication (keys will not be sent).
     * 
     * @documentation {@link https://porkbun.com/api/json/v3/documentation#Domain%20Pricing}
     * @returns {Promise<PorkbunAPIResponses['getPricing']>}
     */
    getPricing() {
        return new Promise((resolve, reject) => {
            const url = this._getEndpoint(`/pricing/get`);
            if(this._queryLogger)
                this._queryLogger({ url, body: {} });
            const headers = {
                'accept': 'application/json',
            }
            if(this._userAgent)
                headers['User-Agent'] = this._userAgent;
            fetch(url, {
                headers,
                method: "GET"
            })
            .then((response) => this._responseHandler(resolve, reject, response, { url, body: {} }))
            .catch((error) => reject(error));
        });
    }

    /**
     * Pings the porkbun api with your keys to test authentication.
     * 
     * @documentation {@link https://porkbun.com/api/json/v3/documentation#Authentication}
     * @returns {Promise<PorkbunAPIResponses['ping']>}
     */
    ping() {
        return this._request({ url: this._getEndpoint(`/ping`) });
    }

    /**
     * Get the name servers for the given domain.
     * 
     * @documentation {@link https://porkbun.com/api/json/v3/documentation#Domain%20Get%20Name%20Servers}
     * @param {string} domain 
     * @returns {Promise<PorkbunAPIResponses['getNameServers']>}
     */
    getNameServers(domain) {
        if(!domain)
            return Promise.reject(new TypeError('Missing domain parameter!'));
        if(typeof domain !== 'string')
            return Promise.reject(new TypeError(`Invalid domain parameter type! Expected 'string', received '${typeof domain}'!`));
        
        return this._request({ url: this._getEndpoint(`/domain/getNs/${domain}`) });
    }

    /**
     * Update the name servers for the given domain.
     * 
     * @documentation {@link https://porkbun.com/api/json/v3/documentation#Domain%20Update%20Name%20Servers}
     * @param {string} domain 
     * @param {string[]} nameservers 
     * @returns {Promise<PorkbunAPIResponses['updateNameServers']>}
     */
    updateNameServers(domain, nameservers) {
        if(!domain)
            return Promise.reject(new TypeError('Missing domain parameter!'));
        if(typeof domain !== 'string')
            return Promise.reject(new TypeError(`Invalid domain parameter type! Expected 'string', received '${typeof domain}'!`));

        if(!nameservers)
            return Promise.reject(new TypeError('Missing nameservers parameter!'));
        if(!Array.isArray(nameservers))
            ///@ts-expect-error - constructor.name is not typed for Object but available on all objects
            return Promise.reject(new TypeError(`Invalid nameservers parameter type! Expected 'array<string>', received '${typeof nameservers === 'object' ? (nameservers?.constructor?.name ?? 'object') : typeof nameservers}'!`));
        const wrongTypedEntries = nameservers.map((nameserver, i) => [nameserver, i]).filter(([nameserver]) => typeof nameserver !== 'string')
        if(wrongTypedEntries.length)
            return Promise.reject(new TypeError(`Invalid nameservers parameter entries type! Expected 'string', received [${wrongTypedEntries.map(([nameserver, i]) => `${i}: '${typeof nameserver}'`).join(', ')}]!`));
        
        return this._request({
            url: this._getEndpoint(`/domain/updateNs/${domain}`),
            body: { ns: nameservers }
        });
    }

    /**
     * Get all domain names for the logged in account. Domains are returned in chunks of 1000.
     * 
     * @documentation {@link https://porkbun.com/api/json/v3/documentation#Domain%20List%20All}
     * @param {Object} [options] 
     * @param {number | `${number}`} [options.start] - An index to start at when retrieving the domains, defaults to 0. To get all domains increment by 1000 until you receive an empty array.
     * @param {boolean} [options.includeLabels] - If set to true, the request will return label information for the domains if it exists.
     * @returns {Promise<PorkbunAPIResponses['getDomains']>}
     */
    getDomains(options) {
        if(options !== null && options !== undefined && typeof options !== 'object')
            return Promise.reject(new TypeError(`Invalid options parameter type! Expected 'object', received '${typeof options}'!`));

        if(options && options.start !== null && options.start !== undefined && typeof options.start !== 'number' && typeof options.start !== 'string')
            return Promise.reject(new TypeError(`Invalid options.start parameter type! Expected 'number', received '${typeof options.start}'!`));
        if(options && options.start !== null && options.start !== undefined && !isNaN(options.start))
            return Promise.reject(new TypeError(`Invalid options.start parameter value! Expected a valid number, received '${options.start}'!`));

        if(options && options.includeLabels !== null && options.includeLabels !== undefined && typeof options.includeLabels !== 'boolean')
            return Promise.reject(new TypeError(`Invalid options.includeLabels parameter type! Expected 'boolean', received '${typeof options.includeLabels}'!`));

        const requestBody = {};

        if(options && !isNaN(options.start))
            requestBody.start = parseInt(options.start).toString();
        if(options && options.includeLabels === true)
            requestBody.includeLabels = 'yes';

        return this._request({
            url: this._getEndpoint(`/domain/listAll`),
            body: requestBody
        });
    }
    
    /**
     * Get URL forwarding for the given domain.
     * 
     * @documentation {@link https://porkbun.com/api/json/v3/documentation#Domain%20Get%20URL%20Forwarding}
     * @param {string} domain 
     * @returns {Promise<PorkbunAPIResponses['getURLForwardings']>}
     */
    getURLForwardings(domain) {
        if(!domain)
            return Promise.reject(new TypeError('Missing domain parameter!'));
        if(typeof domain !== 'string')
            return Promise.reject(new TypeError(`Invalid domain parameter type! Expected 'string', received '${typeof domain}'!`));

        return this._request({ url: this._getEndpoint(`/domain/getUrlForwarding/${domain}`) });
    }

    /**
     * Add an URL forward for the given domain.
     * 
     * @documentation {@link https://porkbun.com/api/json/v3/documentation#Domain%20Add%20URL%20Forward}
     * @param {string} domain 
     * @param {Object} forwardData 
     * @param {string | null | undefined} [forwardData.subdomain] - A subdomain that you would like to add URL forwarding for. Leave unset, set blank, to undefined or to null for the root domain.
     * @param {string} forwardData.location - Where you'd like to forward the domain to.
     * @param {"temporary"|"permanent"} forwardData.type - The type of forward. Valid types are: temporary or permanent
     * @param {boolean} forwardData.includePath - Whether or not to include the URI path in the redirection. 
     * @param {boolean} forwardData.wildcard - Wether or not to forward all subdomains of the domain.
     * @returns {Promise<PorkbunAPIResponses['addURLForwarding']>}
     */
    addURLForward(domain, forwardData) {
        if(!domain)
            return Promise.reject(new TypeError('Missing domain parameter!'));
        if(typeof domain !== 'string')
            return Promise.reject(new TypeError(`Invalid domain parameter type! Expected 'string', received '${typeof domain}'!`));

        if(!forwardData)
            return Promise.reject(new TypeError('Missing forwardData parameter!'));
        if(typeof forwardData !== 'object')
            return Promise.reject(new TypeError(`Invalid forwardData parameter type! Expected 'object', received '${typeof domain}'!`));
        
        if(forwardData.subdomain !== null && forwardData.subdomain !== undefined && typeof forwardData.subdomain !== 'string')
            return Promise.reject(new TypeError(`Invalid forwardData.subdomain parameter type! Expected 'string', received '${typeof forwardData.subdomain}'!`));

        if(!forwardData.location)
            return Promise.reject(new TypeError('Missing forwardData.location parameter!'));
        if(typeof forwardData.location !== 'string')
            return Promise.reject(new TypeError(`Invalid forwardData.location parameter type! Expected 'string', received '${typeof forwardData.location}'!`));

        if(!forwardData.type)
            return Promise.reject(new TypeError('Missing forwardData.type parameter!'));
        if(typeof forwardData.type !== 'string')
            return Promise.reject(new TypeError(`Invalid forwardData.type parameter type! Expected 'permanent' | 'temporary', received '${typeof forwardData.type}'!`));
        if(forwardData.type !== 'permanent' && forwardData.type !== 'temporary')
            return Promise.reject(new TypeError(`Invalid forwardData.type parameter type! Expected 'permanent' | 'temporary', received '${forwardData.type}'!`));

        if(!forwardData.includePath && forwardData.includePath !== false)
            return Promise.reject(new TypeError('Missing forwardData.includePath parameter!'));
        if(typeof forwardData.includePath !== 'boolean')
            return Promise.reject(new TypeError(`Invalid forwardData.includePath parameter type! Expected 'boolean', received '${typeof forwardData.includePath}'!`));

        if(!forwardData.wildcard && forwardData.wildcard !== false)
            return Promise.reject(new TypeError('Missing forwardData.wildcard parameter!'));
        if(typeof forwardData.wildcard !== 'boolean')
            return Promise.reject(new TypeError(`Invalid forwardData.wildcard parameter type! Expected 'boolean', received '${typeof forwardData.wildcard}'!`));

        return this._request({ 
            url: this._getEndpoint(`/domain/addUrlForward/${domain}`),
            body: {
                subdomain:   forwardData.subdomain || '',
                location:    forwardData.location,
                type:        forwardData.type,
                includePath: forwardData.includePath ? 'yes' : 'no',
                wildcard:    forwardData.wildcard    ? 'yes' : 'no',
            }
        });
    }

    /**
     * Delete a URL forward for a domain.
     * 
     * @documentation {@link https://porkbun.com/api/json/v3/documentation#Domain%20Delete%20URL%20Forward}
     * @param {string} domain 
     * @param {PorkbunAPIRecordIDType} recordID 
     * @returns {Promise<PorkbunAPIResponses['deleteURLForwarding']>}
     */
    deleteURLForward(domain, recordID) {
        if(!domain)
            return Promise.reject(new TypeError('Missing domain parameter!'));
        if(typeof domain !== 'string')
            return Promise.reject(new TypeError(`Invalid domain parameter type! Expected 'string', received '${typeof domain}'!`));
        if(!recordID)
            return Promise.reject(new TypeError('Missing recordID parameter!'));
        if(typeof recordID !== 'string')
            return Promise.reject(new TypeError(`Invalid recordID parameter type! Expected 'string', received '${typeof recordID}'!`));

        return this._request({ url: this._getEndpoint(`/domain/deleteUrlForward/${domain}/${recordID}`) });
    }

    /**
     * Check a domain's availability. Please note that domain checks are rate limited and you will be notified of your limit when you cross it.
     * Rate limit is also supplied within the success response in the form of the "limits" property.
     * 
     * @documentation {@link https://porkbun.com/api/json/v3/documentation#Domain%20Check}
     * @param {string} domain 
     * @returns {Promise<PorkbunAPIResponses['checkDomainAvailability']>}
     */
    checkDomain(domain) {
        if(!domain)
            return Promise.reject(new TypeError('Missing domain parameter!'));
        if(typeof domain !== 'string')
            return Promise.reject(new TypeError(`Invalid domain parameter type! Expected 'string', received '${typeof domain}'!`));

        return this._request({ url: this._getEndpoint(`/domain/checkDomain/${domain}`) });
    }

    /**
     * Gets existing glue records for a domain.
     * 
     * @documentation {@link https://porkbun.com/api/json/v3/documentation#Domain%20Get%20Glue%20Records}
     * @param {string} domain 
     * @returns {Promise<PorkbunAPIResponses['getGlueRecords']>}
     */
    getGlueRecords(domain) {
        if(!domain)
            return Promise.reject(new TypeError('Missing domain parameter!'));
        if(typeof domain !== 'string')
            return Promise.reject(new TypeError(`Invalid domain parameter type! Expected 'string', received '${typeof domain}'!`));

        return this._request({ url: this._getEndpoint(`/domain/getGlue/${domain}`) });
    }

    /**
     * Create a glue record for a domain.
     * 
     * @documentation {@link https://porkbun.com/api/json/v3/documentation#Domain%20Create%20Glue%20Record}
     * @param {string} domain 
     * @param {string} glueHostSubdomain - THe subdomain that will be used for the glue record. (eg. 'ns1' for 'ns1.example.com')
     * @param {string[]} ips - An array of IP addresses to associate with the glue record. Accepts both IPv4 and IPv6 addresses.
     * @returns {Promise<PorkbunAPIResponses['createGlueRecord']>}
     */
    createGlueRecord(domain, glueHostSubdomain, ips) {
        if(!domain)
            return Promise.reject(new TypeError('Missing domain parameter!'));
        if(typeof domain !== 'string')
            return Promise.reject(new TypeError(`Invalid domain parameter type! Expected 'string', received '${typeof domain}'!`));
        if(!glueHostSubdomain)
            return Promise.reject(new TypeError('Missing glueHostSubdomain parameter!'));
        if(typeof glueHostSubdomain !== 'string')
            return Promise.reject(new TypeError(`Invalid glueHostSubdomain parameter type! Expected 'string', received '${typeof glueHostSubdomain}'!`));

        if(!ips)
            return Promise.reject(new TypeError('Missing ips parameter!'));
        if(!Array.isArray(ips))
            ///@ts-expect-error - constructor.name is not typed for Object but available on all objects
            return Promise.reject(new TypeError(`Invalid ips parameter type! Expected 'array<string>', received '${typeof ips === 'object' ? (ips?.constructor?.name ?? 'object') : typeof ips}'!`));
        const wrongTypedEntries = ips.map((ip, i) => [ip, i]).filter(([ip]) => typeof ip !== 'string')
        if(wrongTypedEntries.length)
            return Promise.reject(new TypeError(`Invalid ips parameter entries type! Expected 'string', received [${wrongTypedEntries.map(([ip, i]) => `${i}: '${typeof ip}'`).join(', ')}]!`));

        return this._request({
            url: this._getEndpoint(`/domain/createGlue/${domain}/${glueHostSubdomain}`),
            body: { ips }
        });
    }

    /**
     * Update a glue record for a domain.
     * 
     * @documentation {@link https://porkbun.com/api/json/v3/documentation#Domain%20Update%20Glue%20Record}
     * @param {string} domain 
     * @param {string} glueHostSubdomain - THe subdomain used for the glue record. (eg. 'ns1' for 'ns1.example.com')
     * @param {string[]} ips - An array of IP addresses to associate with the glue record. Accepts both IPv4 and IPv6 addresses. Will replace existing glue record ip addresses for the subdomain.
     * @returns {Promise<PorkbunAPIResponses['updateGlueRecord']>}
     */
    updateGlueRecord(domain, glueHostSubdomain, ips) {
        if(!domain)
            return Promise.reject(new TypeError('Missing domain parameter!'));
        if(typeof domain !== 'string')
            return Promise.reject(new TypeError(`Invalid domain parameter type! Expected 'string', received '${typeof domain}'!`));
        if(!glueHostSubdomain)
            return Promise.reject(new TypeError('Missing glueHostSubdomain parameter!'));
        if(typeof glueHostSubdomain !== 'string')
            return Promise.reject(new TypeError(`Invalid glueHostSubdomain parameter type! Expected 'string', received '${typeof glueHostSubdomain}'!`));

        if(!ips)
            return Promise.reject(new TypeError('Missing ips parameter!'));
        if(!Array.isArray(ips))
            ///@ts-expect-error - constructor.name is not typed for Object but available on all objects
            return Promise.reject(new TypeError(`Invalid ips parameter type! Expected 'array<string>', received '${typeof ips === 'object' ? (ips?.constructor?.name ?? 'object') : typeof ips}'!`));
        const wrongTypedEntries = ips.map((ip, i) => [ip, i]).filter(([ip]) => typeof ip !== 'string')
        if(wrongTypedEntries.length)
            return Promise.reject(new TypeError(`Invalid ips parameter entries type! Expected 'string', received [${wrongTypedEntries.map(([ip, i]) => `${i}: '${typeof ip}'`).join(', ')}]!`));

        return this._request({
            url: this._getEndpoint(`/domain/updateGlue/${domain}/${glueHostSubdomain}`),
            body: { ips }
        });
    }

    /**
     * Delete a glue record for a domain.
     * 
     * @documentation {@link https://porkbun.com/api/json/v3/documentation#Domain%20Delete%20Glue%20Record}
     * @param {string} domain 
     * @param {string} glueHostSubdomain - THe subdomain used for the glue record. (eg. 'ns1' for 'ns1.example.com')
     * @returns {Promise<PorkbunAPIResponses['deleteGlueRecord']>}
     */
    deleteGlueRecord(domain, glueHostSubdomain) {
        if(!domain)
            return Promise.reject(new TypeError('Missing domain parameter!'));
        if(typeof domain !== 'string')
            return Promise.reject(new TypeError(`Invalid domain parameter type! Expected 'string', received '${typeof domain}'!`));
        if(!glueHostSubdomain)
            return Promise.reject(new TypeError('Missing glueHostSubdomain parameter!'));
        if(typeof glueHostSubdomain !== 'string')
            return Promise.reject(new TypeError(`Invalid glueHostSubdomain parameter type! Expected 'string', received '${typeof glueHostSubdomain}'!`));

        return this._request({ url: this._getEndpoint(`/domain/deleteGlue/${domain}/${glueHostSubdomain}`) });
    }

    /**
     * Get all DNS records for a domain, optionally filtered by type and subdomain.
     * 
     * documentation: {@link https://porkbun.com/api/json/v3/documentation#DNS%20Retrieve%20Records%20by%20Domain%20or%20ID}
     * 
     * documentation: {@link https://porkbun.com/api/json/v3/documentation#DNS%20Retrieve%20Records%20by%20Domain,%20Subdomain%20and%20Type}
     * 
     * @overload
     * Get all DNS records of a certain type and subdomain. 
     * @param {string} domain 
     * @param {PorkbunAPIDNSRecordTypes} recordType 
     * @param {string | undefined | null} [subdomain] - Leave blank, unset, set to undefined or to null for the root domain.
     * @returns {Promise<PorkbunAPIResponses['getDNSRecords']>}

     * @overload
     * Get all DNS records for a domain.
     * @param {string} domain 
     * @returns {Promise<PorkbunAPIResponses['getDNSRecords']>}
     */
    getDNSRecords(domain, recordType, subdomain) {
        if(!domain)
            return Promise.reject(new TypeError('Missing domain parameter!'));
        if(typeof domain !== 'string')
            return Promise.reject(new TypeError(`Invalid domain parameter type! Expected 'string', received '${typeof domain}'!`));

        if(recordType !== null && recordType !== undefined && typeof recordType !== 'string')
            return Promise.reject(new TypeError(`Invalid recordType parameter type! Expected 'string', received '${typeof recordType}'!`));
        
        if(subdomain !== null && subdomain !== undefined && !recordType)
            return Promise.reject(new TypeError('Missing recordType parameter!'));
        if(subdomain !== null && subdomain !== undefined && typeof subdomain !== 'string')
            return Promise.reject(new TypeError(`Invalid subdomain parameter type! Expected 'string', received '${typeof subdomain}'!`));

        let apiURL = this._getEndpoint(`/dns/retrieve/${domain}`);
        if(recordType && subdomain)
            apiURL = this._getEndpoint(`/dns/retrieveByNameType/${domain}/${recordType}/${subdomain}`);
        else if(recordType)
            apiURL = this._getEndpoint(`/dns/retrieveByNameType/${domain}/${recordType}`);

        return this._request({ url: apiURL });
    }

    /**
     * Get a DNS record by it's ID.
     * 
     * @documentation {@link https://porkbun.com/api/json/v3/documentation#DNS%20Retrieve%20Records%20by%20Domain%20or%20ID}
     * @param {string} domain 
     * @param {string} recordID
     * @returns {Promise<PorkbunAPIResponses['getDNSRecord']>}
     */
    getDNSRecord(domain, recordID) {
        if(!domain)
            return Promise.reject(new TypeError('Missing domain parameter!'));
        if(typeof domain !== 'string')
            return Promise.reject(new TypeError(`Invalid domain parameter type! Expected 'string', received '${typeof domain}'!`));
        if(!recordID)
            return Promise.reject(new TypeError('Missing recordID parameter!'));
        if(typeof recordID !== 'string' && typeof recordID !== 'number')
            return Promise.reject(new TypeError(`Invalid recordID parameter type! Expected 'string'|'number', received '${typeof recordID}'!`));

        return this._request({ url: this._getEndpoint(`/dns/retrieve/${domain}/${recordID}`) });
    }

    /**
     * Create a DNS record for the given domain.
     * 
     * @documentation {@link https://porkbun.com/api/json/v3/documentation#DNS%20Create%20Record}
     * @param {string} domain
     * @param {Object} recordData
     * @param {string|null} recordData.name - The subdomain for the record being created, not including the domain itself. Set as null to create a record on the root domain. Use * to create a wildcard record.
     * @param {PorkbunAPIDNSRecordTypes} recordData.type - The type of record being created. Valid types are: A, MX, CNAME, ALIAS, TXT, NS, AAAA, SRV, TLSA, CAA, HTTPS, SVCB
     * @param {string} recordData.content - The answer content for the record. Please see the DNS management popup from Porkbun's domain management console for proper formatting of each record type.
     * @param {number} [recordData.ttl] - The time to live in seconds for the record. The minimum and the default is 600 seconds.
     * @param {number} [recordData.priority] - The priority of the record for those that support it.
     * @returns {Promise<PorkbunAPIResponses['createDNSRecord']>}
     */
    createDNSRecord(domain, recordData) {
        if(!domain)
            return Promise.reject(new TypeError('Missing domain parameter!'));
        if(typeof domain !== 'string')
            return Promise.reject(new TypeError(`Invalid domain parameter type! Expected 'string', received '${typeof domain}'!`));

        if(!recordData)
            return Promise.reject(new TypeError('Missing recordData parameter!'));
        if(typeof recordData !== 'object')
            return Promise.reject(new TypeError(`Invalid recordData parameter type! Expected 'object', received '${typeof recordData}'!`));

        //* Required properties enforcement & type checker
        if(!recordData.content)
            return Promise.reject(new TypeError('Missing recordData.content parameter!'));
        if(typeof recordData.content !== 'string')
            return Promise.reject(new TypeError(`Invalid recordData.content parameter type! Expected 'string', received '${typeof recordData.content}'!`));

        if(!recordData.type)
            return Promise.reject(new TypeError('Missing recordData.type parameter!'));
        if(typeof recordData.type !== 'string')
            return Promise.reject(new TypeError(`Invalid recordData.type parameter type! Expected 'string', received '${typeof recordData.type}'!`));

        //* Optional properties type checker
        if(recordData.name !== null && recordData.name !== undefined && typeof recordData.name !== 'string')
            return Promise.reject(new TypeError(`Invalid recordData.name parameter type! Expected 'string', received '${typeof recordData.name}'!`));

        if(recordData.ttl !== null && recordData.ttl !== undefined && isNaN(recordData.ttl))
            return Promise.reject(new TypeError(`Invalid recordData.ttl parameter type! Expected 'number', received '${typeof recordData.ttl}'!`));

        if(recordData.priority !== null && recordData.priority !== undefined && isNaN(recordData.priority))
            return Promise.reject(new TypeError(`Invalid recordData.priority parameter type! Expected 'number', received '${typeof recordData.priority}'!`));
        
        const requestBody = {
            name: recordData.name,
            type: recordData.type,
            content: recordData.content
        };

        if(recordData.priority !== null && recordData.priority !== undefined)
            requestBody.prio = parseInt(recordData.priority);
        if(recordData.ttl !== null && recordData.ttl !== undefined)
            requestBody.ttl = parseInt(recordData.ttl);

        return this._request({
            url: this._getEndpoint(`/dns/create/${domain}`),
            body: requestBody
        });
    }

    /**
     * Edit a DNS record by it's ID.
     * 
     * Note: Although the API documentation states that the name field is optional, it is not possible to edit a record without providing one. 
     * If you want to keep the name unchanged, you must provide the current name of the record.
     * 
     * @documentation {@link https://porkbun.com/api/json/v3/documentation#DNS%20Edit%20Record%20by%20Domain%20and%20ID}
     * @param {string} domain
     * @param {string} recordID
     * @param {Object} recordData
     * @param {string|null} recordData.name - The subdomain for the record being edited, not including the domain itself. Set as null to create a record on the root domain. Use * to create a wildcard record.
     * @param {PorkbunAPIDNSRecordTypes} recordData.type - The type of record being created. Valid types are: A, MX, CNAME, ALIAS, TXT, NS, AAAA, SRV, TLSA, CAA, HTTPS, SVCB
     * @param {string} recordData.content - The answer content for the record. Please see the DNS management popup from Porkbun's domain management console for proper formatting of each record type.
     * @param {number} [recordData.ttl] - The time to live in seconds for the record. The minimum and the default is 600 seconds.
     * @param {number} [recordData.priority] - The priority of the record for those that support it.
     * @returns {Promise<PorkbunAPIResponses['editDNSRecord']>}
     */
    editDNSRecord(domain, recordID, recordData) {
        if(!domain)
            return Promise.reject(new TypeError('Missing domain parameter!'));
        if(typeof domain !== 'string')
            return Promise.reject(new TypeError(`Invalid domain parameter type! Expected 'string', received '${typeof domain}'!`));
        if(!recordID)
            return Promise.reject(new TypeError('Missing recordID parameter!'));
        if(typeof recordID !== 'string' && typeof recordID !== 'number')
            return Promise.reject(new TypeError(`Invalid recordID parameter type! Expected 'string'|'number', received '${typeof recordID}'!`));

        
        if(!recordData)
            return Promise.reject(new TypeError('Missing recordData parameter!'));
        if(typeof recordData !== 'object')
            return Promise.reject(new TypeError(`Invalid recordData parameter type! Expected 'object', received '${typeof recordData}'!`));

        if(recordData.content !== null && recordData.content !== undefined && typeof recordData.content !== 'string')
            return Promise.reject(new TypeError(`Invalid recordData.content parameter type! Expected 'string', received '${typeof recordData.content}'!`));

        if(recordData.type !== null && recordData.type !== undefined && typeof recordData.type !== 'string')
            return Promise.reject(new TypeError(`Invalid recordData.type parameter type! Expected 'string', received '${typeof recordData.type}'!`));

        if(recordData.name !== null && recordData.name !== undefined && typeof recordData.name !== 'string')
            return Promise.reject(new TypeError(`Invalid recordData.name parameter type! Expected 'string', received '${typeof recordData.name}'!`));

        if(recordData.ttl !== null && recordData.ttl !== undefined && isNaN(recordData.ttl))
            return Promise.reject(new TypeError(`Invalid recordData.ttl parameter type! Expected 'number', received '${typeof recordData.ttl}'!`));

        if(recordData.priority !== null && recordData.priority !== undefined && isNaN(recordData.priority))
            return Promise.reject(new TypeError(`Invalid recordData.priority parameter type! Expected 'number', received '${typeof recordData.priority}'!`));
        
        const requestBody = {};

        if(recordData.name !== null && recordData.name !== undefined)
            requestBody.name = recordData.name;
        if(recordData.type !== null && recordData.type !== undefined)
            requestBody.type = recordData.type;
        if(recordData.content !== null && recordData.content !== undefined)
            requestBody.content = recordData.content;
        if(recordData.priority !== null && recordData.priority !== undefined)
            requestBody.prio = parseInt(recordData.priority);
        if(recordData.ttl !== null && recordData.ttl !== undefined)
            requestBody.ttl = parseInt(recordData.ttl);

        return this._request({
            url: this._getEndpoint(`/dns/edit/${domain}/${recordID}`),
            body: requestBody
        });
    }

    /**
     * Edit all records for the domain that match a particular type and subdomain.
     * 
     * @documentation {@link https://porkbun.com/api/json/v3/documentation#DNS%20Edit%20Record%20by%20Domain,%20Subdomain%20and%20Type}
     * @param {string} domain
     * @param {PorkbunAPIDNSRecordTypes} recordType
     * @param {string | null | undefined} subdomain - Leave blank, set to undefined or to null for the root domain.
     * @param {Object} recordData
     * @param {PorkbunAPIDNSRecordTypes} [recordData.type] - The type of record being created. Valid types are: A, MX, CNAME, ALIAS, TXT, NS, AAAA, SRV, TLSA, CAA, HTTPS, SVCB
     * @param {string} recordData.content - The answer content for the record. Please see the DNS management popup from Porkbun's domain management console for proper formatting of each record type.
     * @param {number | `${number}`} [recordData.ttl] - The time to live in seconds for the record. The minimum and the default is 600 seconds.
     * @param {number | `${number}`} [recordData.priority] - The priority of the record for those that support it.
     * @returns {Promise<PorkbunAPIResponses['editDNSRecords']>}
     */
    editDNSRecords(domain, recordType, subdomain, recordData) {
        if(!domain)
            return Promise.reject(new TypeError('Missing domain parameter!'));
        if(typeof domain !== 'string')
            return Promise.reject(new TypeError(`Invalid domain parameter type! Expected 'string', received '${typeof domain}'!`));
        if(!recordType)
            return Promise.reject(new TypeError('Missing recordType parameter!'));
        if(typeof recordType !== 'string')
            return Promise.reject(new TypeError(`Invalid recordType parameter type! Expected 'string', received '${typeof recordType}'!`));

        if(subdomain !== undefined && subdomain !== null && typeof subdomain !== 'string')
            return Promise.reject(new TypeError(`Invalid subdomain parameter type! Expected 'string', received '${typeof subdomain}'!`));

        
        if(!recordData)
            return Promise.reject(new TypeError('Missing recordData parameter!'));
        if(typeof recordData !== 'object')
            return Promise.reject(new TypeError(`Invalid recordData parameter type! Expected 'object', received '${typeof recordData}'!`));

        // if(!recordData.content)
        //     return Promise.reject(new TypeError('Missing recordData.content parameter!'));

        if(recordData.content !== null && recordData.content !== undefined && typeof recordData.content !== 'string')
            return Promise.reject(new TypeError(`Invalid recordData.content parameter type! Expected 'string', received '${typeof recordData.content}'!`));

        if(recordData.type !== null && recordData.type !== undefined && typeof recordData.type !== 'string')
            return Promise.reject(new TypeError(`Invalid recordData.type parameter type! Expected 'string', received '${typeof recordData.type}'!`));

        if(recordData.ttl !== null && recordData.ttl !== undefined && isNaN(recordData.ttl))
            return Promise.reject(new TypeError(`Invalid recordData.ttl parameter type! Expected 'number' | '\`\${number}\`', received '${typeof recordData.ttl}'!`));

        if(recordData.priority !== null && recordData.priority !== undefined && isNaN(recordData.priority))
            return Promise.reject(new TypeError(`Invalid recordData.priority parameter type! Expected 'number' | '\`\${number}\`', received '${typeof recordData.priority}'!`));
        
        const requestBody = {};

        if(recordData.type !== null && recordData.type !== undefined)
            requestBody.type = recordData.type;
        if(recordData.content !== null && recordData.content !== undefined)
            requestBody.content = recordData.content;
        if(recordData.priority !== null && recordData.priority !== undefined)
            requestBody.prio = parseInt(recordData.priority).toString();
        if(recordData.ttl !== null && recordData.ttl !== undefined)
            requestBody.ttl = parseInt(recordData.ttl).toString();
        
        let apiURL = this._getEndpoint(`/dns/editByNameType/${domain}/${recordType}`);
        if(subdomain)
            apiURL = this._getEndpoint(`/dns/editByNameType/${domain}/${recordType}/${subdomain}`);

        return this._request({
            url: apiURL,
            body: requestBody
        });
    }

    /**
     * Delete a DNS record by it's ID.
     * 
     * @documentation {@link https://porkbun.com/api/json/v3/documentation#DNS%20Delete%20Record%20by%20Domain%20and%20ID}
     * @param {string} domain 
     * @param {string} recordID
     * @returns {Promise<PorkbunAPIResponses['deleteDNSRecord']>}
     */
    deleteDNSRecord(domain, recordID) {
        if(!domain)
            return Promise.reject(new TypeError('Missing domain parameter!'));
        if(typeof domain !== 'string')
            return Promise.reject(new TypeError(`Invalid domain parameter type! Expected 'string', received '${typeof domain}'!`));
        if(!recordID)
            return Promise.reject(new TypeError('Missing recordID parameter!'));
        if(typeof recordID !== 'string' && typeof recordID !== 'number')
            return Promise.reject(new TypeError(`Invalid recordID parameter type! Expected 'string'|'number', received '${typeof recordID}'!`));

        return this._request({ url: this._getEndpoint(`/dns/delete/${domain}/${recordID}`) });
    }

    /**
     * Delete all records for the domain that match a particular subdomain and type.
     * 
     * @documentation {@link https://porkbun.com/api/json/v3/documentation#DNS%20Delete%20Records%20by%20Domain,%20Subdomain%20and%20Type}
     * @param {string} domain 
     * @param {PorkbunAPIDNSRecordTypes} recordType
     * @param {string | null | undefined} [subdomain] - Leave blank, unset, set to undefined or to null for the root domain.
     * @returns {Promise<PorkbunAPIResponses['deleteDNSRecords']>}
     */
    deleteDNSRecords(domain, recordType, subdomain) {
        if(!domain)
            return Promise.reject(new TypeError('Missing domain parameter!'));
        if(typeof domain !== 'string')
            return Promise.reject(new TypeError(`Invalid domain parameter type! Expected 'string', received '${typeof domain}'!`));
        if(!recordType)
            return Promise.reject(new TypeError('Missing recordType parameter!'));
        if(typeof recordType !== 'string')
            return Promise.reject(new TypeError(`Invalid recordType parameter type! Expected 'string', received '${typeof recordType}'!`));
        
        if(subdomain !== null && subdomain !== undefined && typeof subdomain !== 'string')
            return Promise.reject(new TypeError(`Invalid subdomain parameter type! Expected 'string', received '${typeof subdomain}'!`));

        let apiURL = this._getEndpoint(`/dns/deleteByNameType/${domain}/${recordType}`);
        if(subdomain)
            apiURL = this._getEndpoint(`/dns/deleteByNameType/${domain}/${recordType}/${subdomain}`);

        return this._request({ url: apiURL });
    }

    /**
     * Get the DNSSEC records associated with the domain at the registry.
     * 
     * @documentation {@link https://porkbun.com/api/json/v3/documentation#DNSSEC%20Get%20Records}
     * @param {string} domain 
     * @returns {Promise<PorkbunAPIResponses['deleteDNSRecords']>}
     */
    getDNSSECRecords(domain) {
        if(!domain)
            return Promise.reject(new TypeError('Missing domain parameter!'));
        if(typeof domain !== 'string')
            return Promise.reject(new TypeError(`Invalid domain parameter type! Expected 'string', received '${typeof domain}'!`));

        return this._request({ url: this._getEndpoint(`/dns/getDnssecRecords/${domain}`) });
    }

    /**
     * Create a DNSSEC record at the registry. 
     * Please note that DNSSEC creation differs at the various registries and some elements may or may not be required. 
     * Most often the max sig life and key data elements are not required.
     * 
     * @documentation {@link https://porkbun.com/api/json/v3/documentation#DNSSEC%20Create%20Record}
     * @param {string} domain 
     * @param {Object} recordData 
     * @param {string | number} recordData.keyTag     - Key Tag
     * @param {string | number} recordData.alg        - DS Data Algorithm
     * @param {string | number} recordData.digestType - Digest Type
     * @param {string} recordData.digest              - Digest 
     * @param {string} [recordData.maxSigLife]        - Max Sig Life 
     * @param {string} [recordData.keyDataFlags]      - Key Data Flags
     * @param {string} [recordData.keyDataProtocol]   - Key Data Protocol 
     * @param {string} [recordData.keyDataAlgo]       - Key Data Algorithm 
     * @param {string} [recordData.keyDataPubKey]     - Key Data Public Key 
     * @returns {Promise<PorkbunAPIResponses['createDNSSECRecord']>}
     */
    createDNSSECRecord(domain, recordData) {
        if(!domain)
            return Promise.reject(new TypeError('Missing domain parameter!'));
        if(typeof domain !== 'string')
            return Promise.reject(new TypeError(`Invalid domain parameter type! Expected 'string', received '${typeof domain}'!`));

        if(!recordData)
            return Promise.reject(new TypeError('Missing recordData parameter!'));
        if(typeof recordData !== 'object')
            return Promise.reject(new TypeError(`Invalid recordData parameter type! Expected 'object', received '${typeof recordData}'!`));

        if(!recordData.keyTag)
            return Promise.reject(new TypeError('Missing recordData.keyTag parameter!'));
        if(recordData.keyTag !== null && recordData.keyTag !== undefined && typeof recordData.keyTag !== 'number' && typeof recordData.keyTag !== 'string')
            return Promise.reject(new TypeError(`Invalid recordData.keyTag parameter type! Expected 'number' | 'string', received '${typeof recordData.keyTag}'!`));
        
        if(!recordData.alg)
            return Promise.reject(new TypeError('Missing recordData.alg parameter!'));
        if(recordData.alg !== null && recordData.alg !== undefined && typeof recordData.alg !== 'number' && typeof recordData.alg !== 'string')
            return Promise.reject(new TypeError(`Invalid recordData.alg parameter type! Expected 'number' | 'string', received '${typeof recordData.alg}'!`));

        if(!recordData.digestType)
            return Promise.reject(new TypeError('Missing recordData.digestType parameter!'));
        if(recordData.digestType !== null && recordData.digestType !== undefined && typeof recordData.digestType !== 'number' && typeof recordData.digestType !== 'string')
            return Promise.reject(new TypeError(`Invalid recordData.digestType parameter type! Expected 'number' | 'string', received '${typeof recordData.digestType}'!`));

        if(!recordData.digest)
            return Promise.reject(new TypeError('Missing recordData.digest parameter!'));
        if(recordData.digest !== null && recordData.digest !== undefined && typeof recordData.digest !== 'string')
            return Promise.reject(new TypeError(`Invalid recordData.digest parameter type! Expected 'string', received '${typeof recordData.digest}'!`));

        if(recordData.maxSigLife !== null && recordData.maxSigLife !== undefined && typeof recordData.maxSigLife !== 'string')
            return Promise.reject(new TypeError(`Invalid recordData.maxSigLife parameter type! Expected 'string', received '${typeof recordData.maxSigLife}'!`));

        if(recordData.keyDataFlags !== null && recordData.keyDataFlags !== undefined && typeof recordData.keyDataFlags !== 'string')
            return Promise.reject(new TypeError(`Invalid recordData.keyDataFlags parameter type! Expected 'string', received '${typeof recordData.keyDataFlags}'!`));
        if(recordData.keyDataProtocol !== null && recordData.keyDataProtocol !== undefined && typeof recordData.keyDataProtocol !== 'string')
            return Promise.reject(new TypeError(`Invalid recordData.keyDataProtocol parameter type! Expected 'string', received '${typeof recordData.keyDataProtocol}'!`));
        if(recordData.keyDataAlgo !== null && recordData.keyDataAlgo !== undefined && typeof recordData.keyDataAlgo !== 'string')
            return Promise.reject(new TypeError(`Invalid recordData.keyDataAlgo parameter type! Expected 'string', received '${typeof recordData.keyDataAlgo}'!`));
        if(recordData.keyDataPubKey !== null && recordData.keyDataPubKey !== undefined && typeof recordData.keyDataPubKey !== 'string')
            return Promise.reject(new TypeError(`Invalid recordData.keyDataPubKey parameter type! Expected 'string', received '${typeof recordData.keyDataPubKey}'!`));

        const requestBody = {
            keyTag:     typeof recordData.keyTag === 'number'     ? recordData.keyTag.toString()     : recordData.keyTag,
            alg:        typeof recordData.alg === 'number'        ? recordData.alg.toString()        : recordData.alg,
            digestType: typeof recordData.digestType === 'number' ? recordData.digestType.toString() : recordData.digestType,
            digest:     recordData.digest
        };

        if(recordData.maxSigLife !== null && recordData.maxSigLife !== undefined)
            requestBody.maxSigLife = recordData.maxSigLife;
        if(recordData.keyDataFlags !== null && recordData.keyDataFlags !== undefined)
            requestBody.keyDataFlags = recordData.keyDataFlags;
        if(recordData.keyDataProtocol !== null && recordData.keyDataProtocol !== undefined)
            requestBody.keyDataProtocol = recordData.keyDataProtocol;
        if(recordData.keyDataAlgo !== null && recordData.keyDataAlgo !== undefined)
            requestBody.keyDataAlgo = recordData.keyDataAlgo;
        if(recordData.keyDataPubKey !== null && recordData.keyDataPubKey !== undefined)
            requestBody.keyDataPubKey = recordData.keyDataPubKey;

        return this._request({
            url: this._getEndpoint(`/dns/createDnssecRecord/${domain}`),
            body: requestBody
        });
    }

    /**
     * Delete a DNSSEC record associated with the domain at the registry. 
     * Please note that most registries will delete all records with matching data, not just the record with the matching key tag.
     * 
     * @documentation {@link https://porkbun.com/api/json/v3/documentation#DNSSEC%20Delete%20Record}
     * @param {string} domain 
     * @param {string | number} keyTag 
     * @returns {Promise<PorkbunAPIResponses['deleteDNSSECRecord']>}
     */
    deleteDNSSECRecord(domain, keyTag) {
        if(!domain)
            return Promise.reject(new TypeError('Missing domain parameter!'));
        if(typeof domain !== 'string')
            return Promise.reject(new TypeError(`Invalid domain parameter type! Expected 'string', received '${typeof domain}'!`));

        if(!keyTag && keyTag !== 0)
            return Promise.reject(new TypeError('Missing keyTag parameter!'));
        if(typeof keyTag !== 'number' && typeof keyTag !== 'string')
            return Promise.reject(new TypeError(`Invalid keyTag parameter type! Expected 'number' | 'string', received '${typeof keyTag}'!`));

        return this._request({ url: this._getEndpoint(`/dns/deleteDnssecRecord/${domain}/${keyTag}`) });
    }

    /**
     * Retrieve the SSL certificate bundle for the given domain.
     * 
     * @documentation {@link https://porkbun.com/api/json/v3/documentation#SSL%20Retrieve%20Bundle%20by%20Domain}
     * @param {string} domain 
     * @returns {Promise<PorkbunAPIResponses['getSSLBundle']>}
     */
    getSSLBundle(domain) {
        if(!domain)
            return Promise.reject(new TypeError('Missing domain parameter!'));
        if(typeof domain !== 'string')
            return Promise.reject(new TypeError(`Invalid domain parameter type! Expected 'string', received '${typeof domain}'!`));

        return this._request({ url: this._getEndpoint(`/ssl/retrieve/${domain}`) });
    }
}

module.exports = { PorkbunClient, ResponseError, APIError };