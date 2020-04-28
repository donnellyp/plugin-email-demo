require('dotenv').config();

// Our comms dependencies
const axios = require('axios');
const sgMail = require('@sendgrid/mail');
const twilio = require('twilio')(process.env.ACCOUNT_SID, process.env.AUTH_TOKEN);
const utils = require('./utils');
const extractHtmlContent = require('./extractHtmlContent.js');

sgMail.setApiKey(process.env.SG_MAIL_KEY);

// Express setup
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');

// markdown <> html converter
const showdown = require('showdown');
const showdownConverter = new showdown.Converter();

app.use(bodyParser.urlencoded({
  extended: true
}));

// Handling emails from the SendGrid Inbound Parse webhook
// Sends them into Flex and creates a task
// TODO: No security, validation or sanity checking here..

app.use('/i/', express.static('attachments'));

app.post('/inbound', multer().any(), (req, res) => {
  console.log('inbound email');

  const email = req.body;
  const parsedHeaders = utils.getParsedHeaders(email.headers);
  const fromAddress = parsedHeaders.from.address;
  const fromName = parsedHeaders.from.name;

  const subject = parsedHeaders.subject.replace(/^(?:[rR][Ee][(\[]?\d?[\])]?:\s?)+/gm, '');
  let html = email.html;
  let markdown = email.text;

  const attachments = JSON.parse(email['attachment-info']);

  req.files.forEach(file => {
    const attachment = attachments[file.fieldname];
    if (!attachment) {
      console.log('file not found', file);
      return;
    }

    const ext = attachment['filename'].split('.').pop();
    fs.writeFileSync(`./attachments/${attachment['content-id']}.${ext}`, file.buffer);
    const escapedCid = 'cid\\:' + attachment['content-id'].replace(/-/g, '\\-');
    html = html.replace(new RegExp(escapedCid, 'g'), `https://martin.ngrok.io/i/${attachment['content-id']}.${ext}`);
  });

  try {
    markdown = markdown.replace('Sent from my iPhone', '');
    if (html && html.length) {
      markdown = extractHtmlContent(html);
    }
  } catch (e) { }

  // lol. Trenton, help 😀
  const threadID = fromAddress;
  const uniqueName = `${fromAddress}:${subject}`;
  const emailDateCreated = new Date(Date.parse(parsedHeaders.date));

  const channelArgs = {
    flexFlowSid: process.env.FLEX_FLOW_SID,
    identity: fromAddress,
    chatUniqueName: uniqueName,
    chatUserFriendlyName: fromAddress,
    chatFriendlyName: subject,
    target: uniqueName, // I'm not convinced this is correct, but otherwise it groups by email not thread.
    preEngagementData: JSON.stringify({ threadID, fromName, fromAddress, subject })
  };

  twilio.flexApi.channel.create(channelArgs).then(channel => {
    console.log('got channel', channel.sid);

    getChannel(channel.sid).then(channel => {
      twilio.chat.services(process.env.PROGRAMABLE_CHAT_SERVICE)
        .channels(channel.sid)
        .messages
        .create({
          body: markdown,
          from: fromAddress,
          messageId: parsedHeaders['message-id'],
          inReplyTo: parsedHeaders['in-reply-to'],
          contentType: parsedHeaders['content-type']
        }).then(message => {
          let attrs = JSON.parse(channel.attributes) || {};

          utils.checkTaskPending(twilio, attrs.taskSid).then(pending => {
            if (pending) {
              console.log('not creating a new task because one is in progress');
            } else {
              console.log('pending', pending);
              utils.createTask(twilio, channel.sid, fromAddress)
                .then(task => {
                  console.log('created task', task.sid);

                  attrs.taskSid = task.sid;
                  channel.update({ attributes: JSON.stringify(attrs) })
                    .then(c => console.log('updated channel attributes to', attrs))
                    .catch(e => console.error('failed to update channel attributes', e));
                })
                .catch(e => console.error('failed to create task', e));
            }
          }).catch(e => console.error('failed to send message to flex', e));
        }).catch(e => console.error('cannot convert inbound email to chat because channel doesn\'t exist', e));
    }).catch(e => console.error('failed to create channel', e.response.data));

    res.sendStatus(200);
  });
});

/*
 * Handler for messages within our FlexFlow
 * Created a la:
  curl -X POST "https://flex-api.twilio.com/v1/FlexFlows" \
    --data-urlencode "ChannelType=custom" \
    --data-urlencode "Enabled=true" \
    --data-urlencode "ContactIdentity=null" \
    --data-urlencode "IntegrationType=external" \
    --data-urlencode "Integration.Url=https://xxxxx.ngrok.io/flexflow" \
    --data-urlencode "FriendlyName=Email FlexFlow" \
    --data-urlencode "ChatServiceSid=ISxxxx" \
    --data-urlencode "LongLived=true" \
    -u "$TWILIO_ACCOUNT":"$AUTH_TOKEN"
*/

const toUrlEncoded = obj => Object.keys(obj).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(obj[k])).join('&');
app.post('/flexflow', (req, res) => {
  console.log('got flexflow webhook', req.body);

  if (req.body.Source === 'SDK') {
    console.log('sending e-mail');

    getChannel(req.body.ChannelSid).then(channel => {
      const attrs = JSON.parse(channel.attributes);
      console.log('got channel attrs', attrs);

      // forgive us we have sinned (conflicting FlexFlows.. can't double up the integrations)
      if (attrs.pre_engagement_data.fromAddress == 'trenton@twilio.com'
        && process.env.FORWARD_TRENTON === 1) {
        console.log('forwarding to Trenton!');
        axios.post('https://fuzznuggs.ngrok.io/flexflow', toUrlEncoded(req.body), {
          headers:
            { 'Content-Type': 'application/x-www-form-urlencoded' }
        })
          .then(r => console.log('got', r))
          .catch(e => console.error('failed', e))

        res.sendStatus(200);
        return;
      }

      const html = showdownConverter.makeHtml(req.body.Body);

      const msg = {
        to: attrs.pre_engagement_data.fromAddress,
        from: process.env.FROM_ADDRESS,
        subject: 'RE: ' + attrs.pre_engagement_data.subject,
        text: req.body.Body,
        html: html
      };


      sgMail.send(msg).then(e => {
        console.log('sent email');
      }).catch(e => {
        console.log('failed to send email', e);
      })
    });

    res.sendStatus(200);
  }
});

const getChannel = (channelSid) => {
  return twilio.chat.services(process.env.PROGRAMABLE_CHAT_SERVICE)
    .channels(channelSid)
    .fetch();
}

const port = 8080;
app.listen(port, () => console.log(`e-mail server listening on port ${port}`));
