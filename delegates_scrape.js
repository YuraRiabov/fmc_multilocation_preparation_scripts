#!/usr/bin/env node

// Usage: 
// 
// first of all you will want to download the page from Daniel website with something like: 
// curl -A "Mozilla/5.0" "https://fm.danskspeedcubingforening.dk/competitions/FMC2026/venues" -o page.html
// 
// then you want to download the full json of all delegates from the wca, it is available on the https://www.worldcubeassociation.org/delegates#all page(you need admin access). 
// To get the json just open dev console, and in the Network tab copy the response of this request into a delegates.json file: https://www.worldcubeassociation.org/api/v0/user_roles?sort=name&isActive=true&groupType=delegate_regions&isLead=false&per_page=1000
// 
// After you have both the page.html and delegates.json run this command:
// node delegates_scrape.js page.html delegates.json
//
// Reads each venue's delegate names from page.html,
// looks up their email in delegates.json (skipping trainee_delegates),
// and outputs one line per venue: emails space-separated within a venue, newline between venues.

const fs = require("fs");

const pageFile = process.argv[2] || "page.html";
const delegatesFile = process.argv[3] || "delegates.json";

const html = fs.readFileSync(pageFile, "utf8");
const delegates = JSON.parse(fs.readFileSync(delegatesFile, "utf8"));

// Build a name -> email lookup, excluding trainee_delegates
var emailByName = {};
delegates.forEach(function(entry) {
  if (entry.metadata.status === "trainee_delegate") return;
  var name = entry.user.name.trim();
  emailByName[name] = entry.user.email;
});

// Parse venues and their delegate name lists from page.html
var venuePattern = /<h2>([^<]+)<\/h2>[\s\S]*?<p>Delegates: ([^<]+)<\/p>/g;
var match;
var lines = [];
var missingDelegates = [];

while ((match = venuePattern.exec(html)) !== null) {
  var venue = match[1].trim();
  var names = match[2].trim().split(",").map(function(n) { return n.trim(); });

  var emails = [];
  names.forEach(function(name) {
    var email = emailByName[name];
    if (!email) {
      // Strip parenthetical suffixes like "(吳宇晞)" and retry
      var stripped = name.replace(/\s*\([^)]*\)$/, "").trim();
      email = emailByName[stripped]; //replace with email = name if you need the list of names
    }
    if (email) {
      emails.push(email);
    } else {
      missingDelegates.push(venue + ": " + name);
    }
  });

  lines.push(emails.join(" "));
}

process.stdout.write(lines.join("\n") + "\n");

if (missingDelegates.length > 0) {
  console.error("\nWARNING: Could not find emails for " + missingDelegates.length + " delegate(s):"); // this will include Trainee delegates in current implementation
  missingDelegates.forEach(function(d) { console.error("  " + d); });
  console.error("You may need to update delegates.json.");
}
