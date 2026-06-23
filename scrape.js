#!/usr/bin/env node

// Usage:
//   node scrape_fmc2026.js                   (fetches live from URL)
//   node scrape_fmc2026.js page.html         (reads from local HTML file)
//
// To save HTML manually first:
//   curl -A "Mozilla/5.0" "https://fm.danskspeedcubingforening.dk/competitions/FMC2026/venues" -o page.html
//   node scrape_fmc2026.js page.html

const https = require("https");
const fs = require("fs");
const path = require("path");

const URL = "https://fm.danskspeedcubingforening.dk/competitions/FMC2026/venues";
const outputFile = path.join(__dirname, "fmc2026.csv");

function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, function(res) {
      var data = "";
      res.on("data", function(chunk) { data += chunk; });
      res.on("end", function() { resolve(data); });
    }).on("error", reject);
  });
}

function parseToCSV(html) {
  var rows = [];
  rows.push("venue,participant");

  var venuePattern = /<h2>([^<]+)<\/h2>[\s\S]*?<table[\s\S]*?<\/table>/g;
  var venueMatch;

  while ((venueMatch = venuePattern.exec(html)) !== null) {
    var venueName = venueMatch[1].trim().replace(/"/g, '""');
    rows.push('"' + venueName + '",""');

    var block = venueMatch[0];
    // td tags in this page have a trailing space: <td >
    var localPattern = /<tr>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>accepted<\/td>\s*<\/tr>/g;
    var m;
    while ((m = localPattern.exec(block)) !== null) {
      var name = m[1].trim().replace(/"/g, '""');
      rows.push('"","' + name + '"');
    }
  }

  return rows.join("\n");
}

async function main() {
  var html;
  var inputFile = process.argv[2];

  if (inputFile) {
    console.log("Reading from file:", inputFile);
    html = fs.readFileSync(inputFile, "utf8");
  } else {
    console.log("Fetching from:", URL);
    html = await fetchHTML(URL);
  }

  var venueCount = (html.match(/<h2>/g) || []).length;
  console.log("Found " + venueCount + " venue(s) in HTML.");

  if (venueCount === 0) {
    console.error("No venues found. Try saving the page manually:");
    console.error('  curl -A "Mozilla/5.0" "' + URL + '" -o page.html');
    console.error("  node scrape_fmc2026.js page.html");
    process.exit(1);
  }

  var csv = parseToCSV(html);
  fs.writeFileSync(outputFile, csv + "\n", "utf8");
  console.log("Done. Written to: " + outputFile);
}

main().catch(function(err) {
  console.error("Error:", err.message);
  process.exit(1);
});