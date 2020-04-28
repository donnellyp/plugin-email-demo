require('dotenv').config();

const utils = require('./utils');
const email = require('./email.json');

// Parse the 'headers'.
const parsedHeaders = utils.getParsedHeaders(email.headers);
console.log('got', parsedHeaders);
const markdown = utils.html2markdown(email.html);

// Account SID and Auth Token can be found at https://www.twilio.com/console
const accountSid = process.env.ACCOUNT_SID; // example: AC1234567890abcdef1234567890abcdef
const authToken = process.env.AUTH_TOKEN; // example: fedcba0987654321fedcba0987654321
const client = require('twilio')(accountSid, authToken);
const uniqueName = `${fromAddress}:${subject}`;

let messageProps = {
    'body': markdown,
    'from': fromAddress
};


const threadID = uniqueName;
const channelArgs = {
    flexFlowSid: process.env.FLEX_FLOW_SID,
    identity: uniqueName,
    chatUserFriendlyName: uniqueName,
    chatFriendlyName: `${uniqueName} chat`,
    target: threadID,
    preEngagementData: JSON.stringify({ threadID, fromAddress, subject })
};

const queryString = Object.keys(channelArgs)
    .map(k => `${k}=${encodeURIComponent(channelArgs[k])}`)
    .join('&');

console.log('sending', queryString);

client.flexApi.channel.create(channelArgs).then(channel => {
    console.log('got channel', channel.sid);

    client.chat.services(process.env.PROGRAMABLE_CHAT_SERVICE)
        .channels(channel.sid)
        .messages
        .create({
            body: markdown,
            from: fromAddress
        }).then(() => {
            utils.createTask(client, channel.sid, fromAddress, 'client:mamps')
                .then(task => console.log('created task', task.sid))
                .catch(e => console.error('failed to create task', e));
        });
}).catch(e => {
    console.error('failed to create channel', e.response.data);
});
