const Player = require('../models/Player');
const Match = require('../models/Match');
const Contest = require('../models/Contest');

const IPL_SERIES_ID = '9241';
const API_HOST = process.env.RAPIDAPI_HOST;
const API_KEY = process.env.RAPIDAPI_KEY;

const apiFetch = async (url) => {
  const res = await fetch(url, {
    headers: {
      'x-rapidapi-host': API_HOST,
      'x-rapidapi-key': API_KEY,
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
};

// Map Cricbuzz state to our status
const mapStatus = (state) => {
  if (state === 'Complete') return 'completed';
  if (state === 'In Progress' || state === 'Toss') return 'live';
  return 'upcoming';
};

// Fetch all IPL matches from the series endpoint
const fetchIPLMatches = async () => {
  console.log('🏏 Fetching IPL 2026 schedule...');
  const data = await apiFetch(`https://${API_HOST}/series/v1/${IPL_SERIES_ID}`);

  const matches = [];
  for (const md of data.matchDetails || []) {
    const map = md.matchDetailsMap;
    if (!map) continue;
    for (const m of map.match || []) {
      const mi = m.matchInfo;
      const ms = m.matchScore || {};

      const formatScore = (teamScore) => {
        const inn = teamScore?.inngs1;
        if (!inn) return '';
        return `${inn.runs}/${inn.wickets} (${inn.overs} ov)`;
      };

      matches.push({
        apiId: String(mi.matchId),
        title: `${mi.team1?.teamName} vs ${mi.team2?.teamName}`,
        desc: mi.matchDesc,
        teamA: mi.team1?.teamName,
        teamB: mi.team2?.teamName,
        league: 'Indian Premier League 2026',
        startTime: new Date(parseInt(mi.startDate)),
        status: mapStatus(mi.state),
        result: mi.state === 'Complete' ? mi.status : '',
        scoreA: formatScore(ms.team1Score),
        scoreB: formatScore(ms.team2Score),
        venue: mi.venueInfo ? `${mi.venueInfo.ground}, ${mi.venueInfo.city}` : '',
      });
    }
  }
  return matches;
};

// Fetch players from a completed/live match scorecard
const fetchPlayersFromScorecard = async (matchId, teamAName, teamBName) => {
  try {
    const data = await apiFetch(`https://${API_HOST}/mcenter/v1/${matchId}/hscard`);
    if (!data.scorecard || data.scorecard.length < 1) return [];

    const players = [];
    const playerMap = new Map(); // id -> { name, team, roles: Set, iskeeper }

    const collectPlayers = (arr, teamName, isBowlers = false) => {
      if (!arr) return;
      for (const p of arr) {
        if (!p.name) continue;
        const key = p.id || p.name;
        if (!playerMap.has(key)) {
          playerMap.set(key, { name: p.name, team: teamName, roles: new Set(), iskeeper: p.iskeeper });
        }
        const entry = playerMap.get(key);
        if (p.iskeeper) entry.iskeeper = true;
        if (isBowlers) entry.roles.add('bowler');
        else entry.roles.add('batsman');
      }
    };

    const inn1 = data.scorecard[0];
    const inn2 = data.scorecard[1];

    const inn1BatTeam = inn1.batteamname || inn1.batteamsname || teamAName;
    const inn1BowlTeam = inn2 ? (inn2.batteamname || inn2.batteamsname || teamBName) : teamBName;

    collectPlayers(inn1.batsman, inn1BatTeam, false);
    collectPlayers(inn1.bowler, inn1BowlTeam, true);

    if (inn2) {
      collectPlayers(inn2.batsman, inn2.batteamname || inn2.batteamsname || teamBName, false);
      collectPlayers(inn2.bowler, inn1BatTeam, true);
    }

    // Determine roles using primary skill
    // In T20 scorecards nearly everyone bats, so we use bowling as the differentiator:
    // - keeper → wicket-keeper
    // - batted AND bowled → all-rounder (but cap at ~4 per team to keep balance)
    // - bowled only (or primarily bowler) → bowler
    // - batted only → batsman
    const arCountByTeam = {};
    const entries = [...playerMap.values()];

    for (const entry of entries) {
      let role = 'batsman';
      if (entry.iskeeper) {
        role = 'wicket-keeper';
      } else if (entry.roles.has('bowler') && !entry.roles.has('batsman')) {
        role = 'bowler';
      } else if (entry.roles.has('bowler') && entry.roles.has('batsman')) {
        // Limit all-rounders to 2 per team, rest become bowlers
        const teamAR = arCountByTeam[entry.team] || 0;
        if (teamAR < 2) {
          role = 'all-rounder';
          arCountByTeam[entry.team] = teamAR + 1;
        } else {
          role = 'bowler';
        }
      }

      // Credits: WK 8-9.5, BAT 7-9.5, AR 7.5-9, BOWL 6-8.5
      let minC = 70, maxC = 95;
      if (role === 'wicket-keeper') { minC = 80; maxC = 95; }
      else if (role === 'batsman') { minC = 70; maxC = 95; }
      else if (role === 'all-rounder') { minC = 75; maxC = 90; }
      else if (role === 'bowler') { minC = 60; maxC = 85; }
      const credit = (Math.floor(Math.random() * (maxC - minC + 1) + minC) / 10).toFixed(1);
      players.push({ name: entry.name, team: entry.team, role, credit: parseFloat(credit) });
    }

    return players;
  } catch (err) {
    console.log(`  ⚠️ Could not fetch scorecard for match ${matchId}: ${err.message}`);
    return [];
  }
};

// Main seeder: fetches all IPL data and populates DB
const seedIPLData = async () => {
  try {
    const iplMatches = await fetchIPLMatches();
    if (iplMatches.length === 0) {
      console.log('⚠️ No IPL matches found');
      return false;
    }

    console.log(`✅ Found ${iplMatches.length} IPL 2026 matches`);

    // Clear old data
    await Match.deleteMany({ isCustom: { $ne: true } });
    await Contest.deleteMany({ isCustom: { $ne: true } });
    await Player.deleteMany({});

    // Insert all matches
    const savedMatches = await Match.insertMany(iplMatches);
    console.log(`✅ Saved ${savedMatches.length} matches to DB`);

    // Create contests for upcoming and live matches
    const contestsToInsert = [];
    for (const match of savedMatches) {
      if (match.status === 'upcoming' || match.status === 'live') {
        contestsToInsert.push(
          {
            matchId: match._id,
            name: 'Mega Contest',
            entryFee: 49,
            prizePool: 10000,
            maxTeams: 500,
            prizeBreakdown: [
              { rank: 1, prize: 5000 },
              { rank: 2, prize: 2500 },
              { rank: 3, prize: 1000 },
            ],
          },
          {
            matchId: match._id,
            name: 'Head to Head',
            entryFee: 99,
            prizePool: 180,
            maxTeams: 2,
            prizeBreakdown: [{ rank: 1, prize: 180 }],
          },
          {
            matchId: match._id,
            name: 'Free Entry',
            entryFee: 0,
            prizePool: 100,
            maxTeams: 1000,
            prizeBreakdown: [{ rank: 1, prize: 50 }, { rank: 2, prize: 30 }, { rank: 3, prize: 20 }],
          }
        );
      }
    }

    if (contestsToInsert.length > 0) {
      await Contest.insertMany(contestsToInsert);
      console.log(`✅ Created ${contestsToInsert.length} contests`);
    }

    // Fetch players from the most recent completed or live match that has scorecard data
    const matchesWithScorecard = savedMatches
      .filter(m => m.status === 'completed' || m.status === 'live')
      .sort((a, b) => b.startTime - a.startTime);

    let allPlayers = [];
    // Try up to 3 recent matches to get a good player pool
    for (const match of matchesWithScorecard.slice(0, 3)) {
      console.log(`🔄 Fetching players from: ${match.title} (${match.apiId})...`);
      const players = await fetchPlayersFromScorecard(match.apiId, match.teamA, match.teamB);
      if (players.length > 0) {
        // Avoid duplicate players (same name + team)
        for (const p of players) {
          if (!allPlayers.some(ep => ep.name === p.name && ep.team === p.team)) {
            allPlayers.push(p);
          }
        }
      }
    }

    if (allPlayers.length > 0) {
      await Player.insertMany(allPlayers);
      console.log(`✅ Loaded ${allPlayers.length} players from IPL scorecards`);
    } else {
      console.log('⚠️ No player data available from scorecards');
    }

    return true;
  } catch (error) {
    console.error('❌ IPL data sync failed:', error.message);
    return false;
  }
};

module.exports = {
  seedIPLData,
  fetchIPLMatches,
  fetchPlayersFromScorecard,
};
