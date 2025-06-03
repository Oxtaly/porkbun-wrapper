# porkbun-wrapper

**A simple node.js Porkbun API wrapper with no dependencies to interact with Porkbun's v3 api.**

##### Please keep in mind that for some endpoint response types (like getPricing), the [Porkbun API documentation](https://porkbun.com/api/json/v3/documentation) does not provide a complete schema and as such the response format is my best deduction from testing/using the api and might not always be 100% accurate. Issues/PRs to address missed inaccuracies issues like these are more than welcome.

---

### Pre-requisites:

To use this client, you'll need a secret key and an api key. 
To create your api key, head over to [https://porkbun.com/account/api](https://porkbun.com/account/api) and click on "Create API Key". 

> [!WARNING]
> Keep those keys secure, they give almost full access to your account and all your associated domains!

Once you have your keys, you can use the wrapper, and while pasting them in the client options directly works, I would recommend putting them in a safe location, making use of a module like [`dotenv`](https://www.npmjs.com/package/dotenv) and putting your keys in a `.env` file in the same directory as your main file.

### Installation:

```
npm i porkbun-wrapper 
```

### Usage:

```js
require('dotenv').config();
const { PorkbunClient, ResponseError, APIError } = require('porkbun-wrapper');

const client = new PorkbunClient({
    apiKey:      process.env.PORKBUN_API_KEY,
    secretKey:   process.env.PORKBUN_SECRET_KEY,
    queryLogger: (query) => console.log(query)
});

client.ping()
    .then((response) => {
        console.log('Your keys are valid!');
        console.log(`Response:`, response);
    })
    .catch((error) => {
        if(error instanceof APIError) {
            console.log(`Response:`, error.apiResponse);
            console.error('Are you sure you provided the correct keys?');
            return;
        }
        console.error(
            "An error happened with the request, are you sure the api URL is valid?\n" +
            "Is your internet working correctly?"
        );
        console.error(error);
    });
```

## Examples:

Some basic examples on how you'd create an A record on your root domain, and a CNAME record on the subdomain "www" pointing to your root record.

**For the examples, we'll assume you have  some similar code to this above them that already defines the client & imports the APIError class**
```js
require('dotenv').config();
const { PorkbunClient, ResponseError, APIError } = require('porkbun-wrapper');

const client = new PorkbunClient({
    apiKey:      process.env.PORKBUN_API_KEY,
    secretKey:   process.env.PORKBUN_SECRET_KEY
});
```

- **Linear error handling using await with try catch** 

```js
/** @type {ReturnType<typeof client.createDNSRecord>} */
let rootRecordResponse;
try {
    rootRecordResponse = await client.createDNSRecord("example.com", {
        type: "A",
        name: "", // Empty will set the root domain 
        content: "0.0.0.0",
    });
} catch(error) {
    if(error instanceof APIError) {
        console.error("Something went wrong creating record!");
        console.error(error.apiResponse);
        return;
    }
    console.error(`An error happened with the request!`);
    console.error(error);
    return;
}
const recordID = rootRecordResponse.id; // ID of the record we just created, used to edit or delete it 
console.log(`Successfully created A record, with id ${recordID}`);

/** @type {ReturnType<typeof client.createDNSRecord>} */
let subdomainRecordResponse;
try {
    subdomainRecordResponse = await client.createDNSRecord("example.com", {
        type: "CNAME",
        name: "www", // Name of the subdomain excluding the root domain
        content: "example.com", // Will point to our previous A record
    });
} catch(error) {
    if(error instanceof APIError) {
        console.error("Something went wrong creating record!");
        console.error(error.apiResponse);
        return;
    }
    console.error(`An error happened with the request!`);
    console.error(error);
    return;
}
console.log(`Successfully created CNAME record, with id ${subdomainRecordResponse.id}`);
```

- **Error handling using promises' .then and .catch**

```js
client.createDNSRecord("example.com", {
    type: "A",
    name: "", // Empty will set the root domain 
    content: "0.0.0.0",
}).then((res) => {
    const recordID = res.id; // ID of the record we just created, used to edit or delete it 
    console.info(`Successfully created A record, with id '${recordID}'!`);
    client.createDNSRecord("example.com", {
        type: "CNAME",
        name: "www", // Name of the subdomain excluding the root domain
        content: "example.com", // Will point to our previous A record
    }).then((res) => {
        console.info(`Successfully created CNAME record, with id '${res.id}'!`);
    }).catch((error) => {
        if(error instanceof APIError) {
            console.error("Something went wrong creating record!");
            console.error(error.apiResponse);
            return;
        }
        console.error(`An error happened with the request!`);
        console.error(error);
    });
}).catch((error) => {
    if(error instanceof APIError) {
        console.error("Something went wrong creating record!");
        console.error(error.apiResponse);
        return;
    }
    console.error(`An error happened with the request!`);
    console.error(error);
});
```

---

## Additional information:

ResponseError errors will usually never be thrown as long as the endpoint returns a validly structured JSON response (counter example: calling `client.getDNSRecords(domain, "A", "@")` will have the porkbun api respond with a 400 page in text/html, resulting in an ResponseError error being thrown).

---

I tried my best to implement the API as documented [here](https://porkbun.com/api/json/v3/documentation), but I've found some differing here and there from what is documented and what actually happens. I haven't tested every single method/api endpoint myself, as such, here is a list of untested methods that might not work as expected. Issues or PRs for any discrepancy in the expected behavior of this package and the actual behavior of the api are more than welcome.

Untested methods:
```js
addURLForward(domain, forwardData)                    // With the forward on the root domain
getGlueRecords(domain);                               // With glue records active
createGlueRecord(domain, glueHostSubdomain, ips);     // All
updateGlueRecord(domain, glueHostSubdomain, ips);     // All
deleteGlueRecord(domain, glueHostSubdomain);          // All
editDNSRecords(domain, recordType, null, recordData); // With a root domain record active
deleteDNSRecords(domain, recordType, null);           // With a root domain record active
createDNSSECRecord(domain, recordData);               // All
deleteDNSSECRecord(domain, keyTag);                   // All
```