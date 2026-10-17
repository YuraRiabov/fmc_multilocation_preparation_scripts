#!/usr/bin/env node

// Usage:
//   node scrape.js                   (fetches live from URL)
//   node scrape.js page.html         (reads from local HTML file)
//
// To save HTML manually first:
//   curl -A "Mozilla/5.0" "https://fm.danskspeedcubingforening.dk/competitions/FMCEurope2026/venues" -o page.html
//   node scrape.js page.html

const https = require("https");
const fs = require("fs");
const path = require("path");

const URL = "https://fm.danskspeedcubingforening.dk/competitions/FMCEurope2026/venues";
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

function decodeEntities(str) {
  return str
    .replace(/&#(\d+);/g, function(_, n) { return String.fromCodePoint(parseInt(n, 10)); })
    .replace(/&#x([0-9a-f]+);/gi, function(_, n) { return String.fromCodePoint(parseInt(n, 16)); })
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function csvEscape(str) {
  return str.replace(/"/g, '""');
}

function parseToCSV(html) {
  var rows = [];
  rows.push("venue,participant");

  // Each venue is a <details class="... venue-panel"> block containing an <h2>
  // with the venue name and a <table> with one row per registration:
  //   <tr><td>Name</td><td><span class="status-badge status-accepted">accepted</span></td></tr>
  var blocks = html.split(/<details\b/).slice(1);

  blocks.forEach(function(block) {
    var h2 = block.match(/<h2>([^<]+)<\/h2>/);
    if (!h2) return;
    var venueName = csvEscape(decodeEntities(h2[1]).trim());
    rows.push('"' + venueName + '",""');

    var rowPattern = /<tr>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>\s*<span[^>]*>\s*accepted\s*<\/span>\s*<\/td>\s*<\/tr>/g;
    var m;
    while ((m = rowPattern.exec(block)) !== null) {
      var name = csvEscape(decodeEntities(m[1]).trim());
      rows.push('"","' + name + '"');
    }
  });

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
