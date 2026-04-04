require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: ['http://localhost:5173', 'http://localhost:3000'], methods: ['GET', 'POST'] }
});

// Middleware
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'] }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/players', require('./routes/players'));
app.use('/api/teams', require('./routes/teams'));
app.use('/api/contests', require('./routes/contests'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/admin', require('./routes/admin'));

// Socket.IO
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('register', (userId) => {
    onlineUsers.set(userId, socket.id);
    socket.userId = userId;
  });

  socket.on('chat:send', async (data) => {
    const { receiverId, senderRole } = data;
    if (receiverId) {
      const receiverSocket = onlineUsers.get(receiverId);
      if (receiverSocket) {
        io.to(receiverSocket).emit('chat:receive', data);
      }
    }
    if (senderRole === 'user') {
      socket.broadcast.emit('chat:newMessage', data);
    }
  });

  socket.on('disconnect', () => {
    if (socket.userId) onlineUsers.delete(socket.userId);
  });
});

app.set('io', io);

// Seed demo data
const seedDemoData = async () => {
  const Match = require('./models/Match');
  const User = require('./models/User');
  const Player = require('./models/Player');
  const Contest = require('./models/Contest');

  // Create default admin
  const adminExists = await User.findOne({ role: 'admin' });
  if (!adminExists) {
    const admin = new User({
      name: 'Admin',
      email: 'admin@cricketx.com',
      phone: '9999999999',
      password: 'admin123',
      role: 'admin',
      balance: 0,
    });
    await admin.save();
    console.log('✅ Admin created: admin@cricketx.com / admin123');
  }

  // Seed IPL teams & players
  const playerCount = await Player.countDocuments();
  if (playerCount === 0) {
    console.log('🌱 Seeding IPL players...');
    const iplPlayers = [
      // Mumbai Indians
      { name: 'Rohit Sharma', team: 'Mumbai Indians', role: 'batsman', credit: 10 },
      { name: 'Ishan Kishan', team: 'Mumbai Indians', role: 'wicket-keeper', credit: 9 },
      { name: 'Suryakumar Yadav', team: 'Mumbai Indians', role: 'batsman', credit: 9.5 },
      { name: 'Tilak Varma', team: 'Mumbai Indians', role: 'batsman', credit: 8.5 },
      { name: 'Hardik Pandya', team: 'Mumbai Indians', role: 'all-rounder', credit: 9.5 },
      { name: 'Tim David', team: 'Mumbai Indians', role: 'batsman', credit: 8.5 },
      { name: 'Dewald Brevis', team: 'Mumbai Indians', role: 'all-rounder', credit: 7.5 },
      { name: 'Jasprit Bumrah', team: 'Mumbai Indians', role: 'bowler', credit: 10 },
      { name: 'Piyush Chawla', team: 'Mumbai Indians', role: 'bowler', credit: 7 },
      { name: 'Akash Madhwal', team: 'Mumbai Indians', role: 'bowler', credit: 7.5 },
      { name: 'Gerald Coetzee', team: 'Mumbai Indians', role: 'bowler', credit: 8 },

      // Chennai Super Kings
      { name: 'Ruturaj Gaikwad', team: 'Chennai Super Kings', role: 'batsman', credit: 9.5 },
      { name: 'Devon Conway', team: 'Chennai Super Kings', role: 'batsman', credit: 9 },
      { name: 'Shivam Dube', team: 'Chennai Super Kings', role: 'all-rounder', credit: 8.5 },
      { name: 'Ravindra Jadeja', team: 'Chennai Super Kings', role: 'all-rounder', credit: 9 },
      { name: 'MS Dhoni', team: 'Chennai Super Kings', role: 'wicket-keeper', credit: 8.5 },
      { name: 'Moeen Ali', team: 'Chennai Super Kings', role: 'all-rounder', credit: 8.5 },
      { name: 'Deepak Chahar', team: 'Chennai Super Kings', role: 'bowler', credit: 8.5 },
      { name: 'Tushar Deshpande', team: 'Chennai Super Kings', role: 'bowler', credit: 7.5 },
      { name: 'Maheesh Theekshana', team: 'Chennai Super Kings', role: 'bowler', credit: 8 },
      { name: 'Matheesha Pathirana', team: 'Chennai Super Kings', role: 'bowler', credit: 8.5 },
      { name: 'Rachin Ravindra', team: 'Chennai Super Kings', role: 'batsman', credit: 8 },

      // Royal Challengers Bengaluru
      { name: 'Virat Kohli', team: 'Royal Challengers', role: 'batsman', credit: 10.5 },
      { name: 'Faf du Plessis', team: 'Royal Challengers', role: 'batsman', credit: 9 },
      { name: 'Glenn Maxwell', team: 'Royal Challengers', role: 'all-rounder', credit: 9 },
      { name: 'Rajat Patidar', team: 'Royal Challengers', role: 'batsman', credit: 8 },
      { name: 'Dinesh Karthik', team: 'Royal Challengers', role: 'wicket-keeper', credit: 8 },
      { name: 'Cameron Green', team: 'Royal Challengers', role: 'all-rounder', credit: 9 },
      { name: 'Wanindu Hasaranga', team: 'Royal Challengers', role: 'bowler', credit: 9 },
      { name: 'Harshal Patel', team: 'Royal Challengers', role: 'bowler', credit: 8 },
      { name: 'Mohammed Siraj', team: 'Royal Challengers', role: 'bowler', credit: 8.5 },
      { name: 'Yash Dayal', team: 'Royal Challengers', role: 'bowler', credit: 7.5 },
      { name: 'Karn Sharma', team: 'Royal Challengers', role: 'bowler', credit: 7 },

      // Kolkata Knight Riders
      { name: 'Shreyas Iyer', team: 'Kolkata Knight Riders', role: 'batsman', credit: 9.5 },
      { name: 'Venkatesh Iyer', team: 'Kolkata Knight Riders', role: 'all-rounder', credit: 8 },
      { name: 'Nitish Rana', team: 'Kolkata Knight Riders', role: 'batsman', credit: 8 },
      { name: 'Andre Russell', team: 'Kolkata Knight Riders', role: 'all-rounder', credit: 9.5 },
      { name: 'Sunil Narine', team: 'Kolkata Knight Riders', role: 'all-rounder', credit: 9 },
      { name: 'Phil Salt', team: 'Kolkata Knight Riders', role: 'wicket-keeper', credit: 8.5 },
      { name: 'Rinku Singh', team: 'Kolkata Knight Riders', role: 'batsman', credit: 8.5 },
      { name: 'Varun Chakravarthy', team: 'Kolkata Knight Riders', role: 'bowler', credit: 8 },
      { name: 'Mitchell Starc', team: 'Kolkata Knight Riders', role: 'bowler', credit: 9 },
      { name: 'Harshit Rana', team: 'Kolkata Knight Riders', role: 'bowler', credit: 7.5 },
      { name: 'Ramandeep Singh', team: 'Kolkata Knight Riders', role: 'all-rounder', credit: 7 },

      // Delhi Capitals
      { name: 'David Warner', team: 'Delhi Capitals', role: 'batsman', credit: 9.5 },
      { name: 'Rishabh Pant', team: 'Delhi Capitals', role: 'wicket-keeper', credit: 9.5 },
      { name: 'Prithvi Shaw', team: 'Delhi Capitals', role: 'batsman', credit: 8 },
      { name: 'Axar Patel', team: 'Delhi Capitals', role: 'all-rounder', credit: 8.5 },
      { name: 'Tristan Stubbs', team: 'Delhi Capitals', role: 'batsman', credit: 7.5 },
      { name: 'Mitchell Marsh', team: 'Delhi Capitals', role: 'all-rounder', credit: 8.5 },
      { name: 'Kuldeep Yadav', team: 'Delhi Capitals', role: 'bowler', credit: 8.5 },
      { name: 'Anrich Nortje', team: 'Delhi Capitals', role: 'bowler', credit: 8.5 },
      { name: 'Mukesh Kumar', team: 'Delhi Capitals', role: 'bowler', credit: 7.5 },
      { name: 'Ishant Sharma', team: 'Delhi Capitals', role: 'bowler', credit: 7 },
      { name: 'Lalit Yadav', team: 'Delhi Capitals', role: 'all-rounder', credit: 7 },

      // Gujarat Titans
      { name: 'Shubman Gill', team: 'Gujarat Titans', role: 'batsman', credit: 10 },
      { name: 'Wriddhiman Saha', team: 'Gujarat Titans', role: 'wicket-keeper', credit: 8 },
      { name: 'Sai Sudharsan', team: 'Gujarat Titans', role: 'batsman', credit: 8 },
      { name: 'David Miller', team: 'Gujarat Titans', role: 'batsman', credit: 8.5 },
      { name: 'Rashid Khan', team: 'Gujarat Titans', role: 'bowler', credit: 9.5 },
      { name: 'Rahul Tewatia', team: 'Gujarat Titans', role: 'all-rounder', credit: 8 },
      { name: 'Vijay Shankar', team: 'Gujarat Titans', role: 'all-rounder', credit: 7.5 },
      { name: 'Mohammed Shami', team: 'Gujarat Titans', role: 'bowler', credit: 9 },
      { name: 'Noor Ahmad', team: 'Gujarat Titans', role: 'bowler', credit: 7.5 },
      { name: 'Sandeep Warrier', team: 'Gujarat Titans', role: 'bowler', credit: 7 },
      { name: 'Azmatullah Omarzai', team: 'Gujarat Titans', role: 'all-rounder', credit: 7.5 },

      // Rajasthan Royals
      { name: 'Yashasvi Jaiswal', team: 'Rajasthan Royals', role: 'batsman', credit: 9.5 },
      { name: 'Jos Buttler', team: 'Rajasthan Royals', role: 'wicket-keeper', credit: 9.5 },
      { name: 'Sanju Samson', team: 'Rajasthan Royals', role: 'wicket-keeper', credit: 9 },
      { name: 'Shimron Hetmyer', team: 'Rajasthan Royals', role: 'batsman', credit: 8 },
      { name: 'Dhruv Jurel', team: 'Rajasthan Royals', role: 'wicket-keeper', credit: 7.5 },
      { name: 'Riyan Parag', team: 'Rajasthan Royals', role: 'all-rounder', credit: 8 },
      { name: 'Ravichandran Ashwin', team: 'Rajasthan Royals', role: 'bowler', credit: 8.5 },
      { name: 'Trent Boult', team: 'Rajasthan Royals', role: 'bowler', credit: 9 },
      { name: 'Yuzvendra Chahal', team: 'Rajasthan Royals', role: 'bowler', credit: 8.5 },
      { name: 'Sandeep Sharma', team: 'Rajasthan Royals', role: 'bowler', credit: 7 },
      { name: 'Nandre Burger', team: 'Rajasthan Royals', role: 'bowler', credit: 7.5 },

      // Punjab Kings
      { name: 'Shikhar Dhawan', team: 'Punjab Kings', role: 'batsman', credit: 9 },
      { name: 'Jonny Bairstow', team: 'Punjab Kings', role: 'wicket-keeper', credit: 9 },
      { name: 'Liam Livingstone', team: 'Punjab Kings', role: 'all-rounder', credit: 9 },
      { name: 'Jitesh Sharma', team: 'Punjab Kings', role: 'wicket-keeper', credit: 7.5 },
      { name: 'Sam Curran', team: 'Punjab Kings', role: 'all-rounder', credit: 8.5 },
      { name: 'Sikandar Raza', team: 'Punjab Kings', role: 'all-rounder', credit: 8 },
      { name: 'Kagiso Rabada', team: 'Punjab Kings', role: 'bowler', credit: 9 },
      { name: 'Arshdeep Singh', team: 'Punjab Kings', role: 'bowler', credit: 8.5 },
      { name: 'Rahul Chahar', team: 'Punjab Kings', role: 'bowler', credit: 7.5 },
      { name: 'Nathan Ellis', team: 'Punjab Kings', role: 'bowler', credit: 7.5 },
      { name: 'Harpreet Brar', team: 'Punjab Kings', role: 'all-rounder', credit: 7 },

      // Sunrisers Hyderabad
      { name: 'Travis Head', team: 'Sunrisers Hyderabad', role: 'batsman', credit: 9.5 },
      { name: 'Abhishek Sharma', team: 'Sunrisers Hyderabad', role: 'all-rounder', credit: 8.5 },
      { name: 'Heinrich Klaasen', team: 'Sunrisers Hyderabad', role: 'wicket-keeper', credit: 9.5 },
      { name: 'Aiden Markram', team: 'Sunrisers Hyderabad', role: 'batsman', credit: 8.5 },
      { name: 'Abdul Samad', team: 'Sunrisers Hyderabad', role: 'batsman', credit: 7.5 },
      { name: 'Washington Sundar', team: 'Sunrisers Hyderabad', role: 'all-rounder', credit: 8 },
      { name: 'Bhuvneshwar Kumar', team: 'Sunrisers Hyderabad', role: 'bowler', credit: 8.5 },
      { name: 'T Natarajan', team: 'Sunrisers Hyderabad', role: 'bowler', credit: 8 },
      { name: 'Umran Malik', team: 'Sunrisers Hyderabad', role: 'bowler', credit: 7.5 },
      { name: 'Pat Cummins', team: 'Sunrisers Hyderabad', role: 'bowler', credit: 9.5 },
      { name: 'Shahbaz Ahmed', team: 'Sunrisers Hyderabad', role: 'all-rounder', credit: 7.5 },

      // Lucknow Super Giants
      { name: 'KL Rahul', team: 'Lucknow Super Giants', role: 'wicket-keeper', credit: 10 },
      { name: 'Quinton de Kock', team: 'Lucknow Super Giants', role: 'wicket-keeper', credit: 9 },
      { name: 'Nicholas Pooran', team: 'Lucknow Super Giants', role: 'batsman', credit: 8.5 },
      { name: 'Ayush Badoni', team: 'Lucknow Super Giants', role: 'batsman', credit: 7.5 },
      { name: 'Deepak Hooda', team: 'Lucknow Super Giants', role: 'all-rounder', credit: 8 },
      { name: 'Marcus Stoinis', team: 'Lucknow Super Giants', role: 'all-rounder', credit: 9 },
      { name: 'Krunal Pandya', team: 'Lucknow Super Giants', role: 'all-rounder', credit: 8 },
      { name: 'Mark Wood', team: 'Lucknow Super Giants', role: 'bowler', credit: 8.5 },
      { name: 'Ravi Bishnoi', team: 'Lucknow Super Giants', role: 'bowler', credit: 8 },
      { name: 'Avesh Khan', team: 'Lucknow Super Giants', role: 'bowler', credit: 7.5 },
      { name: 'Yash Thakur', team: 'Lucknow Super Giants', role: 'bowler', credit: 7 },
    ];

    await Player.insertMany(iplPlayers);
    console.log(`✅ ${iplPlayers.length} IPL players seeded`);
  }

  // Seed matches
  const matchCount = await Match.countDocuments();
  if (matchCount === 0) {
    console.log('🌱 Seeding IPL matches...');
    const now = new Date();
    const matches = await Match.insertMany([
      {
        title: 'Mumbai Indians vs Chennai Super Kings',
        teamA: 'Mumbai Indians',
        teamB: 'Chennai Super Kings',
        league: 'IPL 2026',
        startTime: new Date(now.getTime() + 4 * 3600000),
        status: 'upcoming',
      },
      {
        title: 'Royal Challengers vs Delhi Capitals',
        teamA: 'Royal Challengers',
        teamB: 'Delhi Capitals',
        league: 'IPL 2026',
        startTime: new Date(now.getTime() + 8 * 3600000),
        status: 'upcoming',
      },
      {
        title: 'Gujarat Titans vs Rajasthan Royals',
        teamA: 'Gujarat Titans',
        teamB: 'Rajasthan Royals',
        league: 'IPL 2026',
        startTime: new Date(now.getTime() + 24 * 3600000),
        status: 'upcoming',
      },
      {
        title: 'Kolkata Knight Riders vs Punjab Kings',
        teamA: 'Kolkata Knight Riders',
        teamB: 'Punjab Kings',
        league: 'IPL 2026',
        startTime: new Date(now.getTime() + 28 * 3600000),
        status: 'upcoming',
      },
      {
        title: 'Sunrisers Hyderabad vs Lucknow Super Giants',
        teamA: 'Sunrisers Hyderabad',
        teamB: 'Lucknow Super Giants',
        league: 'IPL 2026',
        startTime: new Date(now.getTime() + 48 * 3600000),
        status: 'upcoming',
      },
      {
        title: 'Chennai Super Kings vs Royal Challengers',
        teamA: 'Chennai Super Kings',
        teamB: 'Royal Challengers',
        league: 'IPL 2026',
        startTime: new Date(now.getTime() + 72 * 3600000),
        status: 'upcoming',
      },
    ]);

    // Seed contests for each match
    for (const match of matches) {
      await Contest.insertMany([
        {
          matchId: match._id,
          name: 'Mega Contest',
          entryFee: 49,
          prizePool: 10000,
          maxTeams: 500,
          prizeBreakdown: [{ rank: 1, prize: 5000 }, { rank: 2, prize: 2500 }, { rank: 3, prize: 1500 }, { rank: 4, prize: 1000 }],
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
          name: 'Practice (Free)',
          entryFee: 0,
          prizePool: 0,
          maxTeams: 1000,
          prizeBreakdown: [],
        },
        {
          matchId: match._id,
          name: 'Winners Take All',
          entryFee: 199,
          prizePool: 50000,
          maxTeams: 500,
          prizeBreakdown: [{ rank: 1, prize: 25000 }, { rank: 2, prize: 10000 }, { rank: 3, prize: 5000 }, { rank: 4, prize: 3000 }, { rank: 5, prize: 2000 }],
        },
      ]);
    }
    console.log('✅ IPL matches & contests seeded');
  }
};

// Start
const PORT = process.env.PORT || 5000;
const startServer = async () => {
  const dbConnected = await connectDB();
  if (dbConnected) await seedDemoData();
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    if (!dbConnected) console.log('⚠️  Database not connected.');
  });
};
startServer();
