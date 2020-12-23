const { WebClient } = require("@slack/web-api");
const { App, LogLevel } = require("@slack/bolt");
const cron = require("node-cron");
const fetch = require("node-fetch");

// set up .env file
const dotenv = require("dotenv");
dotenv.config();

// Create a new instance of the WebClient class
const web = new WebClient(process.env.SLACK_TOKEN);
const app = new App({
  token: process.env.SLACK_TOKEN,
  signingSecret: process.env.SIGNING_SECRET,
  // LogLevel can be imported and used to make debugging simpler
  logLevel: LogLevel.DEBUG,
});
const sporcleBotChannelName = "bot-test";

// Start app
(async () => {
  await app.start(process.env.PORT || 3000);
  console.log("⚡️ Bolt app is running!");
})();

//run this code every day at noon, mon-fri
// https://crontab.guru/examples.html
// cron.schedule('0 12 * * 1-5', () => {
// });

//every two min
cron.schedule("*/2 * * * *", () => {
  //sendMessage(sporcleBotChannelName, "hey there! I'm sending a message every 2 minutes :)")
});

async function sendMessage(channel, text, blocks) {
  try {
    await web.chat.postMessage({
      channel: channel,
      text: text,
      blocks: blocks,
    });
  } catch (error) {
    console.log(error);
  }

  console.log("Message posted!");
}

findConversation(sporcleBotChannelName);

// Find conversation ID
async function findConversation(name) {
  try {
    // Call the conversations.list method using the built-in WebClient
    const result = await app.client.conversations.list({
      token: process.env.SLACK_TOKEN,
    });

    for (const channel of result.channels) {
      if (channel.name === name) {
        conversationId = channel.id;

        console.log(channel.name);
        console.log("Found conversation ID: " + conversationId);

        // get convo history
        fetchHistory(conversationId);
        break;
      }
    }
  } catch (error) {
    console.error(error);
  }
}

// Fetch conversation history using id
async function fetchHistory(id) {
  try {
    // Call the conversations.history method using the built-in WebClient
    const result = await app.client.conversations.history({
      token: process.env.SLACK_TOKEN,
      channel: id,
    });
    findCurrentSporcleChallenge(result.messages, id);
  } catch (error) {
    console.error(error);
  }
}

function findCurrentSporcleChallenge(conversationHistory, id) {
  const currentTime = new Date().getTime() / 1000; // time in seconds

  // loop through all messages starting with the oldest
  for (let i = conversationHistory.length - 1; i >= 0; i--) {
    let messageTs = conversationHistory[i].ts;

    // find messages within last 24 hours
    if (messageTs < currentTime && messageTs > currentTime - 24 * 3600) {
      // check if message has sporcle url text
      if (conversationHistory[i].text.includes("www.sporcle.com")) {
        // get message replies
        fetch(
          "https://slack.com/api/conversations.replies/?token=" +
            process.env.SLACK_TOKEN +
            "&channel=" +
            id +
            "&ts=" +
            conversationHistory[i].ts
        )
          .then((response) => response.json())
          .then((sporcleReplies) => {
            rankPlayers(sporcleReplies.messages);
          });
        break; // We only need to match the oldest Sporcle link
      }
    }
  }
}

function rankPlayers(messages) {
  // User readable score format: @bholcomb scored 19/24 with 0:13 remaining.
  // Actual messages score format: <@U01G0QVPYP9> scored 19/24 with 0:13 remaining.
  const scoreRegex = /^\<\@.+\>\sscored\s\d+\/\d+\swith\s\d+\:\d\d\sremaining\.$/;
  let allPlayerData = [];

  // start at 1 to ignore first message (original post w/ url)
  for (let j = 1; j < messages.length; j++) {
    // Get messages with score format
    if (scoreRegex.test(messages[j].text)) {
      const resultArray = messages[j].text.split(/\s/);

      const user = resultArray[0];
      const score = parseInt(resultArray[2].split("/")[0]);
      const time = resultArray[4];

      const playerDataObject = {
        user: user,
        score: score,
        time: time,
      };

      // Prevent users from posting multiple scores (only take first score)
      const playerAlreadyPostedScore = allPlayerData.find(
        (player) => player.user === user
      );
      if (!playerAlreadyPostedScore) allPlayerData.push(playerDataObject);
    }
  }

  allPlayerData.sort(comparePlayers);
  formatLeaderboard(allPlayerData);
}

function comparePlayers(p1, p2) {
  if (p1.score < p2.score) return 1;
  if (p1.score > p2.score) return -1;
  if (p1.score === p2.score) {
    const p1TimeArray = p1.time.split(":");
    const p2TimeArray = p2.time.split(":");
    const p1Minute = parseInt(p1TimeArray[0]);
    const p2Minute = parseInt(p2TimeArray[0]);
    const p1Second = parseInt(p1TimeArray[1]);
    const p2Second = parseInt(p2TimeArray[1]);

    if (p1Minute < p2Minute) return 1;
    if (p1Minute > p2Minute) return -1;
    if (p1Minute === p2Minute) {
      if (p1Second > p2Second) return -1;
      return 1; // This should default to the first poster if there is a tie with score and time
    }
  }
  return 0;
}

function formatLeaderboard(playerData) {
  if (playerData.length > 0) {
    let leaderboard = "";
    playerData.forEach((player, index) => {
      if (index === 0) {
        leaderboard += ":first_place_medal: ";
      } else if (index === 1) {
        leaderboard += ":second_place_medal: ";
      } else if (index === 2) {
        leaderboard += ":third_place_medal: ";
      } else {
        leaderboard += ":star: ";
      }
      leaderboard += `${player.user} \n\n`;
    });

    const congrats = {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "*Congratulations* to today's Sporcle challenge winners! :tada: :tada: :tada:\n",
      },
    };
    const medals = {
      type: "section",
      text: {
        type: "mrkdwn",
        text: leaderboard,
      },
      accessory: {
        type: "image",
        image_url:
          "https://res-4.cloudinary.com/dostuff-media/image/upload//w_1200,q_75,c_limit,f_auto/v1562185151/event-image-10897103-e66725aa-114a-4087-bc57-3bc70f8102ab.jpg",
        alt_text: "celebration",
      },
    };
    const upNext = {
      type: "section",
      block_id: "section789",
      text: {
        type: "mrkdwn",
        text: `Total players: ${playerData.length}\n\n${playerData[0].user} will choose the next Sporcle quiz :sunglasses:`,
      },
    };
    let leaderboardMessage = [congrats, medals, upNext];

    sendMessage(sporcleBotChannelName, "", leaderboardMessage);
  } else {
    sendMessage(
      sporcleBotChannelName,
      "No one took the quiz from yesterday! Anyone is allowed to post a new quiz today."
    );
  }
}
