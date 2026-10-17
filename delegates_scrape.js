#!/usr/bin/env node

// Usage: 
// 
// first of all you will want to download the page from Daniel website with something like: 
// curl -A "Mozilla/5.0" "https://fm.danskspeedcubingforening.dk/competitions/FMCEurope2026/venues" -o page.html
// 
// then you want to download the full json of all delegates from the wca, it is available on the https://www.worldcubeassociation.org/delegates#all page(you need admin access). 
// To get the json just open dev console, and in the Network tab copy the response of this request into a delegates.json file: https://www.worldcubeassociation.org/api/v0/user_roles?sort=name&isActive=true&groupType=delegate_regions&isLead=false&per_page=1000
// 
// After you have both the page.html and delegates.json run this command:
// node delegates_scrape.js page.html delegates.json
//
// Reads each venue's delegate names from page.html,
// looks up their email in delegates.json, and outputs:
//   1. one line per venue with full delegates' emails (space-separated within a venue)
//   2. then, after a "# Trainee delegates" header, one "Venue: emails" line for each venue that has trainees
//   3. then (on stderr) a warning listing delegates not found at all

const fs = require("fs");

const pageFile = process.argv[2] || "page.html";
const delegatesFile = process.argv[3] || "delegates.json";

const html = fs.readFileSync(pageFile, "utf8");
const delegates = JSON.parse(fs.readFileSync(delegatesFile, "utf8"));

// Build name -> email lookups, trainees kept separate from full delegates
var emailByName = {};
var traineeEmailByName = {};
delegates.forEach(function(entry) {
  var name = entry.user.name.trim();
  if (entry.metadata.status === "trainee_delegate") {
    traineeEmailByName[name] = entry.user.email;
  } else {
    emailByName[name] = entry.user.email;
  }
});

// Look up a name in a table, retrying without a parenthetical suffix like "(吳宇晞)"
function lookup(table, name) {
  if (table[name]) return table[name];
  var stripped = name.replace(/\s*\([^)]*\)$/, "").trim();
  return table[stripped];
}

// Parse venues and their delegate name lists from page.html
// Each venue has an <h2>venue name</h2> followed by
// <span>Delegates</span><strong>Name1, Name2</strong>
var venuePattern = /<h2>([^<]+)<\/h2>[\s\S]*?<span>Delegates<\/span><strong>([^<]*)<\/strong>/g;

function decodeEntities(str) {
  return str
    .replace(/&#(\d+);/g, function(_, n) { return String.fromCodePoint(parseInt(n, 10)); })
    .replace(/&#x([0-9a-f]+);/gi, function(_, n) { return String.fromCodePoint(parseInt(n, 16)); })
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
var match;
var lines = [];
var traineeLines = [];
var missingDelegates = [];

while ((match = venuePattern.exec(html)) !== null) {
  var venue = decodeEntities(match[1]).trim();
  var names = decodeEntities(match[2]).trim().split(",").map(function(n) { return n.trim(); }).filter(Boolean);

  var emails = [];
  var traineeEmails = [];
  names.forEach(function(name) {
    var email = lookup(emailByName, name); // replace with email = name if you need the list of names
    var traineeEmail = lookup(traineeEmailByName, name);
    if (email) {
      if (emails.indexOf(email) === -1) emails.push(email); // dedupe (a delegate can be listed twice)
    } else if (traineeEmail) {
      if (traineeEmails.indexOf(traineeEmail) === -1) traineeEmails.push(traineeEmail);
    } else {
      missingDelegates.push(venue + ": " + name);
    }
  });

  lines.push(emails.join(" "));
  if (traineeEmails.length > 0) traineeLines.push(venue + ": " + traineeEmails.join(" "));
}

process.stdout.write(lines.join("\n") + "\n");
if (traineeLines.length > 0) {
  process.stdout.write("\n# Trainee delegates (only venues that have any)\n");
  process.stdout.write(traineeLines.join("\n") + "\n");
}

if (missingDelegates.length > 0) {
  console.error("\nWARNING: Could not find emails for " + missingDelegates.length + " delegate(s):");
  missingDelegates.forEach(function(d) { console.error("  " + d); });
  console.error("You may need to update delegates.json.");
}
