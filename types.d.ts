
export type PorkbunAPIStatuses = "SUCCESS" | "ERROR";
export type PorkbunAPIDNSRecordTypes = "A" | "MX" | "CNAME" | "ALIAS" | "TXT" | "NS" | "AAAA" | "SRV" | "TLSA" | "CAA" | "HTTPS" | "SVCB";

export type PorkbunAPIRecordIDType = `${number}` | string;

export interface PorkbunClientOptions {
    /** API key used for authentication. */
    apiKey: string; 
    /** Secret key used for authentication. */
    secretKey: string;
    /** Base api endpoint used by the wrapper. @default {"https://api.porkbun.com/api/json/v3"} */
    endpoint?: string;
    /** Logger that takes in the requests made by the client. Does not include api keys. */
    queryLogger?: (query: { url: string, body: Object }) => void; 
    /** User-Agent header sent with the requests. Set to null to send the default (usually "node") Node.js User-Agent header. @default {"porkbun-wrapper"} */
    userAgent?: string;
}


export type PorkbunAPIDNSRecord = {
    id:      PorkbunAPIRecordIDType, 
    name:    string, 
    type:    PorkbunAPIDNSRecordTypes, 
    content: string, 
    ttl:     string, 
    prio:    string | null, 
    notes:   string | null
}

export type PorkbunAPIResponse<SuccessData> = { status: "SUCCESS" } & SuccessData;

export interface PorkbunAPIResponses {
    getPricing: PorkbunAPIResponse<{
        /** Objects with default pricing for the registration, renewal and transfer of each supported TLD. */
        pricing: {
            [key: string]: { 
                registration: `${number}`, 
                renewal: `${number}`, 
                transfer: `${number}`, 
                coupons: [] | { 
                    registration: { 
                        code: string, 
                        max_per_user: number, 
                        first_year_only: "yes"|"no", 
                        type: "amount", 
                        amount?: number
                    }
                },
                specialType?: "handshake"
            }
        }
    }>;
    ping: PorkbunAPIResponse<{ 
        yourIp: string,
        /** Undocumented field. */
        xForwardedFor?: string
    }>;
    getNameServers: PorkbunAPIResponse<{ 
        /** An array of name server host names. */
        ns: string[]
    }>;
    updateNameServers: PorkbunAPIResponse<{}>;
    getDomains: PorkbunAPIResponse<{
        /** An array of domains and domain details in the account. */
        domains: {
            domain: string, 
            status: "ACTIVE", 
            tld: string, 
            createDate: string, 
            expireDate: string, 
            securityLock: "1"|"0", 
            whoisPrivacy: "1"|"0", 
            autoRenew: "1"|"0", 
            notLocal: "1"|"0", 
            labels?: {
                id: `${number}`, 
                color: string, 
                title: string
            }[]
        }[]
    }>;
    getURLForwardings: PorkbunAPIResponse<{
        /** An array of forwarding records for the domain. */
        forwards: { 
            id: `${number}`, 
            subdomain: string, 
            location: string, 
            type: "temporary"|"permanent", 
            includePath: "yes"|"no", 
            wildcard: "yes"|"no"
        }[]
    }>;
    addURLForwarding: PorkbunAPIResponse<{}>;
    deleteURLForwarding: PorkbunAPIResponse<{}>;
    checkDomainAvailability: PorkbunAPIResponse<{
        response: {
            avail: "yes"|"no",
            type: "registration",
            price: `${number}`,
            firstYearPromo: "yes"|"no",
            regularPrice: `${number}`,
            premium: "yes"|"no",
            additional: {
                renewal: {
                    type: "renewal",
                    price: `${number}`,
                    regularPrice: `${number}`
                },
                transfer: {
                    type: "transfer",
                    price: `${number}`,
                    regularPrice: `${number}`
                }
            }
        },
        limits: {
            TTL: `${number}`,
            limit: `${number}`,
            used: number,
            naturalLanguage: string
        }
    }>;
    getGlueRecords: PorkbunAPIResponse<{
        hosts: [
            /** Subdomain + domain */
            string,
            {
                v6: string[],
                v4: string[]
            }
        ][] | null
    }>
    createGlueRecord: PorkbunAPIResponse<{}>;
    updateGlueRecord: PorkbunAPIResponse<{}>;
    deleteGlueRecord: PorkbunAPIResponse<{}>;
    getDNSRecords: PorkbunAPIResponse<{
        /** Undocumented field. */
        cloudflare?: "enabled"|"disabled", 
        records: PorkbunAPIDNSRecord[]
    }>;
    getDNSRecord: PorkbunAPIResponse<{
        /** Undocumented field. */
        cloudflare?: "enabled"|"disabled", 
        records: [PorkbunAPIDNSRecord]
    }>;
    createDNSRecord: PorkbunAPIResponse<{ id: `${number}` }>;
    editDNSRecord: PorkbunAPIResponse<{}>;
    editDNSRecords: PorkbunAPIResponse<{}>;
    deleteDNSRecord: PorkbunAPIResponse<{}>;
    deleteDNSRecords: PorkbunAPIResponse<{}>;
    getDNSSECRecords: PorkbunAPIResponse<{
        /** The DNSSEC records pulled from the registry. */
        records: {
            [key: `${number}`]: {
                keyTag: `${number}`,
                alg: `${number}`,
                digestType: `${number}`,
                digest: string,
            }
        }
    }>;
    createDNSSECRecord: PorkbunAPIResponse<{}>;
    deleteDNSSECRecord: PorkbunAPIResponse<{}>;
    getSSLBundle: PorkbunAPIResponse<{
        /** The complete certificate chain. */
        certificatechain: string,
        /** The private key. */
        privatekey: string,
        /** The public key. */
        publickey: string
    }>
}