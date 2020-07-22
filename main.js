/** 
 * Protein
 * Version 1.3.1
 * Discord bot to keep a tally of points for exercise with a leaderboard system and info system.
 * Currently planned is a monthly or weekly competition element.
 * By Steven Wheeler.
 */

//Load required libraries.
const Discord = require("discord.js");
const Enmap = require("enmap");
const SQLite = require("better-sqlite3");
const fs = require("fs");

//Load config and declare a new client.
const config = require("./config.json");
const client = new Discord.Client();
client.config = config;
//Declare the database files.
const scoresDB = new SQLite('./scores.sqlite');
const bannedDB = new SQLite('./bans.sqlite');

//Function used later in code to update the monthly databases current month.
function updateMonthlyDBMonth() {
  let output = client.getMonthlyScore.get(`MONTH`);
    //Get date info from OS...
    var date = new Date();
    //Split into month with preceeding 0...
    var month = ("0" + (date.getMonth() + 1)).slice(-2);  
    //Prepare database entry...
    if (!output) {
      input = {
          id: `MONTH`,
          points: month,
      }
      //Send to database...
      client.setMonthlyScore.run(input);
    }
}

//When client is logged in and declared ready to discord server...
client.on("ready", () => {
  //Declare successful connection to Discord.
  console.log("[" + (new Date()) + "] " + "Successfully logged in as " + client.user.tag + ".");
  //Check for points scheme file.
  console.log("[" + (new Date()) + "] " + "Checking for suitable points scheme...");
  if (fs.existsSync("./pointscheme.json")) {
    console.log("[" + (new Date()) + "] " + "Points scheme was successfully found.");
  }
  //Declare start of DB preparation.
  console.log("[" + (new Date()) + "] " + "Preparing SQL databases...");
  //If the table isn't there, create it and setup the databases correctly.
  scoresDB.prepare("CREATE TABLE IF NOT EXISTS overallScores (id TEXT PRIMARY KEY, points INTEGER, lastSubmit DATE);").run();
  scoresDB.prepare("CREATE TABLE IF NOT EXISTS monthlyScores (id TEXT PRIMARY KEY, points INTEGER);").run();
  bannedDB.prepare("CREATE TABLE IF NOT EXISTS bannedIDs (id TEXT PRIMARY KEY, banDate DATE);").run();
  //Ensure that the "id" row is always unique and indexed.
  scoresDB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_overallScores_id ON overallScores (id);").run();
  scoresDB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_monthlyScores_id ON monthlyScores (id);").run();
  bannedDB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_bannedIDs_id ON bannedIDs (id);").run();
  //Apply options to scores database.
  scoresDB.pragma("synchronous = 1");
  scoresDB.pragma("journal_mode = wal");
  //Prepare SQL statements.
  client.getScore = scoresDB.prepare("SELECT * FROM overallScores WHERE id = ?");
  client.setScore = scoresDB.prepare("INSERT OR REPLACE INTO overallScores (id, points, lastSubmit) VALUES (@id, @points, @lastSubmit);");
  client.getMonthlyScore = scoresDB.prepare("SELECT * FROM monthlyScores WHERE id = ?");
  client.setMonthlyScore = scoresDB.prepare("INSERT OR REPLACE INTO monthlyScores (id, points) VALUES (@id, @points);");
  client.checkForBan = bannedDB.prepare("SELECT * FROM bannedIDs WHERE id = ?");
  client.banUser = bannedDB.prepare("INSERT OR REPLACE INTO bannedIDs (id, banDate) VALUES (@id, @banDate);");
  client.unbanUser = bannedDB.prepare("DELETE FROM bannedIDs WHERE id = ?");
  //Check if monthlyScores has the month entry, else add it.
  updateMonthlyDBMonth();
  //Declare boot complete.
  console.log("[" + (new Date()) + "] " + "SQL databases prepared.");
  console.log("[" + (new Date()) + "] " + "Boot sequence complete.");
});

//Load the events.
fs.readdir("./events/", (err, files) => {
  //If cant read events, abort.
  if (err) return console.error(err);
  //For each file...
  files.forEach(file => {
    //Declare it as required.
    const event = require(`./events/${file}`);
    //Get the event name from the file name.
    let eventName = file.split(".")[0];
    //Listen for event.
    client.on(eventName, event.bind(null, client));
  });
});

//Prepare a map of commands.
client.commands = new Enmap();

//Read the commands folder.
fs.readdir("./commands/", (err, files) => {
  console.log("[" + (new Date()) + "] " + "Loading commands...");
  //If cant read events, abort.
  if (err) return console.error(err);
  //For each file...
  files.forEach(file => {
    //Check the file ends with .js, otherwise ignore it.
    if (!file.endsWith(".js")) return;
    //Declare the command as required.
    let props = require(`./commands/${file}`);
    //Get the command name from the file name.
    let commandName = file.split(".")[0];
    //Load the command into the map.
    console.log("[" + (new Date()) + "] " + `Loading command "${commandName}" into the command map.`);
    client.commands.set(commandName, props);
  });
  console.log("[" + (new Date()) + "] " + "Commands succesfully loaded.");
});

//The following section is to check the monthly database and clear it if its the next month.
function checkForEndOfMonth() {
  //Get date info from OS.
  var date = new Date();
  //Split into month with preceeding 0.
  var month = ("0" + (date.getMonth() + 1)).slice(-2);
  //Get database table creation month.
  let output = client.getMonthlyScore.get(`MONTH`);
  var dbMonth = ("0" + (output.points)).slice(-2);
  //Check if month has changed.
  if (month != dbMonth) {
    //Month has changed.
    console.log("[" + (new Date()) + "] " + "The monthly leaderboard has now expired. resetting for the next month...");
    //Drop the old monthly table.
    scoresDB.prepare("DROP TABLE monthlyScores;").run();
    //Create the new monthly table.
    scoresDB.prepare("CREATE TABLE monthlyScores (id TEXT PRIMARY KEY, points INTEGER);").run();
    scoresDB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_monthlyScores_id ON monthlyScores (id);").run();
    //Update the tables month info.
    updateMonthlyDBMonth();
    //Declare monthly update complete.
    console.log("[" + (new Date()) + "] " + "The monthly leaderboard has been successfully reset.");
  } else {
    //Month has not changed.
    return;
  }
}
//Run the checkForEndOfMonth function every second.
setInterval(checkForEndOfMonth, 1*1000);

//Begin login to discord.
console.log("[" + (new Date()) + "] " + "Logging into discord...");
client.login(config.token);