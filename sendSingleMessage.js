const { WebClient } = require('@slack/web-api');

// set up .env file
const dotenv = require('dotenv');
dotenv.config();


// Create a new instance of the WebClient class with the token read from your environment variable
const web = new WebClient(process.env.SLACK_TOKEN_SANDBOX); 

(async () => {
  try {
    // Use the `chat.postMessage` method to send a message from this app
    await web.chat.postMessage({
      channel: '#dt-hackathon-slackbot', //change to name of channel
      text: `Hello!`,
    });
  } catch (error) {
    console.log(error);
  }
  console.log('Message posted!');
})();
