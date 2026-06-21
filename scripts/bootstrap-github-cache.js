import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const username = 'BakerSean168';
const url = `https://github.com/users/${username}/contributions`;

async function bootstrap() {
  try {
    console.log(`Fetching contributions for ${username}...`);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const data = await res.text();
    
    // Parse days
    const tdRegex = /<td([^>]*class="[^"]*ContributionCalendar-day[^"]*"[^>]*)>/g;
    let match;
    const daysMap = {};
    const daysList = [];
    
    while ((match = tdRegex.exec(data)) !== null) {
      const attrs = match[1];
      const dateMatch = attrs.match(/data-date="([^"]+)"/);
      const levelMatch = attrs.match(/data-level="([^"]+)"/);
      const idMatch = attrs.match(/id="([^"]+)"/);
      
      if (dateMatch && levelMatch && idMatch) {
        const id = idMatch[1];
        const day = {
          date: dateMatch[1],
          level: parseInt(levelMatch[1], 10),
          tooltip: ''
        };
        daysMap[id] = day;
        daysList.push(day);
      }
    }
    
    // Parse tooltips
    const tooltipRegex = /<tool-tip[^>]*for="([^"]+)"[^>]*>([\s\S]*?)<\/tool-tip>/g;
    let ttMatch;
    let ttCount = 0;
    while ((ttMatch = tooltipRegex.exec(data)) !== null) {
      const forId = ttMatch[1];
      const text = ttMatch[2].trim();
      if (daysMap[forId]) {
        daysMap[forId].tooltip = text;
        ttCount++;
      }
    }
    
    // Sort chronologically
    daysList.sort((a, b) => a.date.localeCompare(b.date));
    
    if (daysList.length === 0) {
      throw new Error("No contribution days parsed from HTML. GitHub structure might have changed.");
    }
    
    console.log(`Successfully parsed ${daysList.length} days and matched ${ttCount} tooltips.`);
    
    // Write to src/data/github-contributions.json
    const dataDir = path.join(__dirname, '../src/data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const cachePath = path.join(dataDir, 'github-contributions.json');
    fs.writeFileSync(cachePath, JSON.stringify({
      username,
      updatedAt: new Date().toISOString(),
      contributions: daysList
    }, null, 2));
    
    console.log(`Cache written to ${cachePath}`);
  } catch (error) {
    console.error('Bootstrap failed:', error);
    process.exit(1);
  }
}

bootstrap();
