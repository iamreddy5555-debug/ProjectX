import https from 'https';
import fs from 'fs';

const options = {
  hostname: 'cricbuzz-cricket.p.rapidapi.com',
  port: 443,
  path: '/mcenter/v1/40381/hscard',
  method: 'GET',
  headers: {
    'x-rapidapi-host': 'cricbuzz-cricket.p.rapidapi.com',
    'x-rapidapi-key': '370b0f0093mshf60930efe2a4767p17cb44jsna690a8e87445',
    'Content-Type': 'application/json'
  }
};

console.log('Fetching live data from Cricbuzz RapidAPI...');

const req = https.request(options, (res) => {
  let chunks = [];

  res.on('data', (chunk) => {
    chunks.push(chunk);
  });

  res.on('end', () => {
    const body = Buffer.concat(chunks).toString();
    console.log('Response saved to api_response.json!');
    fs.writeFileSync('api_response.json', body, 'utf8');
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.end();
