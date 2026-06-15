const readline = require("readline");
const botgram = require("botgram");
const fs = require("fs").promises;
const util = require("util");
const utils = require("./utils");

// Wizard functions

const stepAuthToken = async (rl, config) => {
  try {
    const token = await question(rl, "First, enter your bot API token: ");
    const trimmedToken = token.trim();
    config.authToken = trimmedToken;
    return await createBot(trimmedToken);
  } catch (err) {
    console.error(`Invalid token was entered, please try again.\n${err}\n`);
    return stepAuthToken(rl, config);
  }
};

const stepOwner = async (rl, config, getNextMessage) => {
  console.log("Waiting for a message...");
  const msg = await getNextMessage();
  const prompt = `Should ${msg.chat.type} «${msg.chat.name}» (${msg.chat.id}) be the bot's owner? [y/n]: `;
  const answer = await question(rl, prompt);
  console.log();
  const normalized = answer.trim().toLowerCase();
  if (normalized === "y" || normalized === "yes") {
    config.owner = msg.chat.id;
  } else {
    return stepOwner(rl, config, getNextMessage);
  }
};

const configWizard = async (options) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const config = {};
  let bot = null;

  try {
    bot = await stepAuthToken(rl, config);
    console.log(`\nNow, talk to me so I can discover your Telegram user:\n${bot.link()}\n`);

    const getNextMessage = getPromiseFactory(bot);
    await stepOwner(rl, config, getNextMessage);

    console.log("All done, writing the configuration...");
    const contents = JSON.stringify(config, null, 4) + "\n";
    await fs.writeFile(options.configFile, contents, "utf-8");
  } catch (err) {
    console.error(`Error, wizard crashed:\n${err.stack}`);
    process.exit(1);
  } finally {
    rl.close();
    if (bot) bot.stop();
    process.exit(0);
  }
};

// Promise utilities

const question = (interface, query) => new Promise((resolve) => {
  interface.question(query, resolve);
});

const createBot = (token) => new Promise((resolve, reject) => {
  const bot = botgram(token, { agent: utils.createAgent() });
  bot.on("error", (err) => {
    bot.stop();
    reject(err);
  });
  bot.on("ready", () => resolve(bot));
});

const getPromiseFactory = (bot) => {
  let resolveCbs = [];
  bot.message((msg, reply, next) => {
    if (!msg.queued) {
      resolveCbs.forEach((resolve) => {
        resolve(msg);
      });
      resolveCbs = [];
    }
    next();
  });
  return () => new Promise((resolve) => {
    resolveCbs.push(resolve);
  });
};

module.exports = { configWizard };
