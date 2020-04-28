const extractHtmlContent = require('../server/extractHtmlContent.js');

const simpleParser = require('mailparser').simpleParser;
const fs = require('fs');

const threadIndex = 'thread-001';

const testThread = require ("../test/sample-emails/"+ threadIndex + "/"+ threadIndex + ".json");

for (const message of testThread){
    let emlPath = '../test/sample-emails/' + threadIndex + '/' + message.message_id + '.eml';
    let eml = fs.readFileSync(emlPath, "utf-8");
    simpleParser(eml, {})
    .then(parsed => {
            if (extractHtmlContent(parsed.html) === message.current_content) {
                console.log('-------Pass:' + message.message_id + '------');
            } else {
                console.log('-------Fail:' + message.message_id + '------');
                console.log('=======Expected Output:' + message.message_id + '======');
                console.log(message.current_content);
                console.log('=======Current Output:' + message.message_id + '======');
                console.log(extractHtmlContent(parsed.html));
                console.log('--------------------');
            }
    })
    .catch(err => {
        console.log(err);
    });
}

