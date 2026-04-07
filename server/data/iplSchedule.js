// Real IPL 2026 schedule — fetched from Cricbuzz API. Used as fallback when API is unavailable.
// 70 matches, March 28 - May 24, 2026

const SCHEDULE = [
  { id: 149618, desc: '1st Match', team1: 'Sunrisers Hyderabad', team2: 'Royal Challengers Bengaluru', start: '2026-03-28T14:00:00.000Z', venue: 'M.Chinnaswamy Stadium, Bengaluru' },
  { id: 149629, desc: '2nd Match', team1: 'Kolkata Knight Riders', team2: 'Mumbai Indians', start: '2026-03-29T14:00:00.000Z', venue: 'Wankhede Stadium, Mumbai' },
  { id: 149640, desc: '3rd Match', team1: 'Chennai Super Kings', team2: 'Rajasthan Royals', start: '2026-03-30T14:00:00.000Z', venue: 'Barsapara Cricket Stadium, Guwahati' },
  { id: 149651, desc: '4th Match', team1: 'Gujarat Titans', team2: 'Punjab Kings', start: '2026-03-31T14:00:00.000Z', venue: 'Maharaja Yadavindra Singh Cricket Stadium, Mullanpur' },
  { id: 149662, desc: '5th Match', team1: 'Lucknow Super Giants', team2: 'Delhi Capitals', start: '2026-04-01T14:00:00.000Z', venue: 'Bharat Ratna Shri Atal Bihari Vajpayee Ekana Cricket Stadium, Lucknow' },
  { id: 149673, desc: '6th Match', team1: 'Sunrisers Hyderabad', team2: 'Kolkata Knight Riders', start: '2026-04-02T14:00:00.000Z', venue: 'Eden Gardens, Kolkata' },
  { id: 149684, desc: '7th Match', team1: 'Chennai Super Kings', team2: 'Punjab Kings', start: '2026-04-03T14:00:00.000Z', venue: 'MA Chidambaram Stadium, Chennai' },
  { id: 149695, desc: '8th Match', team1: 'Mumbai Indians', team2: 'Delhi Capitals', start: '2026-04-04T10:00:00.000Z', venue: 'Arun Jaitley Stadium, Delhi' },
  { id: 149699, desc: '9th Match', team1: 'Rajasthan Royals', team2: 'Gujarat Titans', start: '2026-04-04T14:00:00.000Z', venue: 'Narendra Modi Stadium, Ahmedabad' },
  { id: 149710, desc: '10th Match', team1: 'Sunrisers Hyderabad', team2: 'Lucknow Super Giants', start: '2026-04-05T10:00:00.000Z', venue: 'Rajiv Gandhi International Stadium, Hyderabad' },
  { id: 149721, desc: '11th Match', team1: 'Royal Challengers Bengaluru', team2: 'Chennai Super Kings', start: '2026-04-05T14:00:00.000Z', venue: 'M.Chinnaswamy Stadium, Bengaluru' },
  { id: 149732, desc: '12th Match', team1: 'Kolkata Knight Riders', team2: 'Punjab Kings', start: '2026-04-06T14:00:00.000Z', venue: 'Eden Gardens, Kolkata' },
  { id: 149743, desc: '13th Match', team1: 'Rajasthan Royals', team2: 'Mumbai Indians', start: '2026-04-07T14:00:00.000Z', venue: 'Barsapara Cricket Stadium, Guwahati' },
  { id: 149746, desc: '14th Match', team1: 'Delhi Capitals', team2: 'Gujarat Titans', start: '2026-04-08T14:00:00.000Z', venue: 'Arun Jaitley Stadium, Delhi' },
  { id: 149757, desc: '15th Match', team1: 'Kolkata Knight Riders', team2: 'Lucknow Super Giants', start: '2026-04-09T14:00:00.000Z', venue: 'Eden Gardens, Kolkata' },
  { id: 149768, desc: '16th Match', team1: 'Rajasthan Royals', team2: 'Royal Challengers Bengaluru', start: '2026-04-10T14:00:00.000Z', venue: 'Barsapara Cricket Stadium, Guwahati' },
  { id: 149779, desc: '17th Match', team1: 'Punjab Kings', team2: 'Sunrisers Hyderabad', start: '2026-04-11T10:00:00.000Z', venue: 'Maharaja Yadavindra Singh Cricket Stadium, Mullanpur' },
  { id: 149790, desc: '18th Match', team1: 'Chennai Super Kings', team2: 'Delhi Capitals', start: '2026-04-11T14:00:00.000Z', venue: 'MA Chidambaram Stadium, Chennai' },
  { id: 149801, desc: '19th Match', team1: 'Lucknow Super Giants', team2: 'Gujarat Titans', start: '2026-04-12T10:00:00.000Z', venue: 'Bharat Ratna Shri Atal Bihari Vajpayee Ekana Cricket Stadium, Lucknow' },
  { id: 149812, desc: '20th Match', team1: 'Mumbai Indians', team2: 'Royal Challengers Bengaluru', start: '2026-04-12T14:00:00.000Z', venue: 'Wankhede Stadium, Mumbai' },
  { id: 151752, desc: '21st Match', team1: 'Sunrisers Hyderabad', team2: 'Rajasthan Royals', start: '2026-04-13T14:00:00.000Z', venue: 'Rajiv Gandhi International Stadium, Hyderabad' },
  { id: 151763, desc: '22nd Match', team1: 'Chennai Super Kings', team2: 'Kolkata Knight Riders', start: '2026-04-14T14:00:00.000Z', venue: 'MA Chidambaram Stadium, Chennai' },
  { id: 151774, desc: '23rd Match', team1: 'Royal Challengers Bengaluru', team2: 'Lucknow Super Giants', start: '2026-04-15T14:00:00.000Z', venue: 'M.Chinnaswamy Stadium, Bengaluru' },
  { id: 151785, desc: '24th Match', team1: 'Mumbai Indians', team2: 'Punjab Kings', start: '2026-04-16T14:00:00.000Z', venue: 'Wankhede Stadium, Mumbai' },
  { id: 151796, desc: '25th Match', team1: 'Gujarat Titans', team2: 'Kolkata Knight Riders', start: '2026-04-17T14:00:00.000Z', venue: 'Narendra Modi Stadium, Ahmedabad' },
  { id: 151807, desc: '26th Match', team1: 'Royal Challengers Bengaluru', team2: 'Delhi Capitals', start: '2026-04-18T10:00:00.000Z', venue: 'M.Chinnaswamy Stadium, Bengaluru' },
  { id: 151818, desc: '27th Match', team1: 'Sunrisers Hyderabad', team2: 'Chennai Super Kings', start: '2026-04-18T14:00:00.000Z', venue: 'Rajiv Gandhi International Stadium, Hyderabad' },
  { id: 151829, desc: '28th Match', team1: 'Kolkata Knight Riders', team2: 'Rajasthan Royals', start: '2026-04-19T10:00:00.000Z', venue: 'Eden Gardens, Kolkata' },
  { id: 151840, desc: '29th Match', team1: 'Punjab Kings', team2: 'Lucknow Super Giants', start: '2026-04-19T14:00:00.000Z', venue: 'Maharaja Yadavindra Singh Cricket Stadium, Mullanpur' },
  { id: 151845, desc: '30th Match', team1: 'Gujarat Titans', team2: 'Mumbai Indians', start: '2026-04-20T14:00:00.000Z', venue: 'Narendra Modi Stadium, Ahmedabad' },
  { id: 151856, desc: '31st Match', team1: 'Sunrisers Hyderabad', team2: 'Delhi Capitals', start: '2026-04-21T14:00:00.000Z', venue: 'Rajiv Gandhi International Stadium, Hyderabad' },
  { id: 151867, desc: '32nd Match', team1: 'Lucknow Super Giants', team2: 'Rajasthan Royals', start: '2026-04-22T14:00:00.000Z', venue: 'Bharat Ratna Shri Atal Bihari Vajpayee Ekana Cricket Stadium, Lucknow' },
  { id: 151878, desc: '33rd Match', team1: 'Mumbai Indians', team2: 'Chennai Super Kings', start: '2026-04-23T14:00:00.000Z', venue: 'Wankhede Stadium, Mumbai' },
  { id: 151889, desc: '34th Match', team1: 'Royal Challengers Bengaluru', team2: 'Gujarat Titans', start: '2026-04-24T14:00:00.000Z', venue: 'M.Chinnaswamy Stadium, Bengaluru' },
  { id: 151891, desc: '35th Match', team1: 'Delhi Capitals', team2: 'Punjab Kings', start: '2026-04-25T10:00:00.000Z', venue: 'Arun Jaitley Stadium, Delhi' },
  { id: 151902, desc: '36th Match', team1: 'Rajasthan Royals', team2: 'Sunrisers Hyderabad', start: '2026-04-25T14:00:00.000Z', venue: 'Sawai Mansingh Stadium, Jaipur' },
  { id: 151913, desc: '37th Match', team1: 'Gujarat Titans', team2: 'Chennai Super Kings', start: '2026-04-26T10:00:00.000Z', venue: 'Narendra Modi Stadium, Ahmedabad' },
  { id: 151924, desc: '38th Match', team1: 'Lucknow Super Giants', team2: 'Kolkata Knight Riders', start: '2026-04-26T14:00:00.000Z', venue: 'Bharat Ratna Shri Atal Bihari Vajpayee Ekana Cricket Stadium, Lucknow' },
  { id: 151935, desc: '39th Match', team1: 'Delhi Capitals', team2: 'Royal Challengers Bengaluru', start: '2026-04-27T14:00:00.000Z', venue: 'Arun Jaitley Stadium, Delhi' },
  { id: 151943, desc: '40th Match', team1: 'Punjab Kings', team2: 'Rajasthan Royals', start: '2026-04-28T14:00:00.000Z', venue: 'Maharaja Yadavindra Singh Cricket Stadium, Mullanpur' },
  { id: 151954, desc: '41st Match', team1: 'Mumbai Indians', team2: 'Sunrisers Hyderabad', start: '2026-04-29T14:00:00.000Z', venue: 'Wankhede Stadium, Mumbai' },
  { id: 151965, desc: '42nd Match', team1: 'Gujarat Titans', team2: 'Royal Challengers Bengaluru', start: '2026-04-30T14:00:00.000Z', venue: 'Narendra Modi Stadium, Ahmedabad' },
  { id: 151976, desc: '43rd Match', team1: 'Rajasthan Royals', team2: 'Delhi Capitals', start: '2026-05-01T14:00:00.000Z', venue: 'Sawai Mansingh Stadium, Jaipur' },
  { id: 151987, desc: '44th Match', team1: 'Chennai Super Kings', team2: 'Mumbai Indians', start: '2026-05-02T14:00:00.000Z', venue: 'MA Chidambaram Stadium, Chennai' },
  { id: 151998, desc: '45th Match', team1: 'Sunrisers Hyderabad', team2: 'Kolkata Knight Riders', start: '2026-05-03T10:00:00.000Z', venue: 'Rajiv Gandhi International Stadium, Hyderabad' },
  { id: 152009, desc: '46th Match', team1: 'Gujarat Titans', team2: 'Punjab Kings', start: '2026-05-03T14:00:00.000Z', venue: 'Narendra Modi Stadium, Ahmedabad' },
  { id: 152020, desc: '47th Match', team1: 'Mumbai Indians', team2: 'Lucknow Super Giants', start: '2026-05-04T14:00:00.000Z', venue: 'Wankhede Stadium, Mumbai' },
  { id: 152031, desc: '48th Match', team1: 'Delhi Capitals', team2: 'Chennai Super Kings', start: '2026-05-05T14:00:00.000Z', venue: 'Arun Jaitley Stadium, Delhi' },
  { id: 152042, desc: '49th Match', team1: 'Sunrisers Hyderabad', team2: 'Punjab Kings', start: '2026-05-06T14:00:00.000Z', venue: 'Rajiv Gandhi International Stadium, Hyderabad' },
  { id: 152053, desc: '50th Match', team1: 'Lucknow Super Giants', team2: 'Royal Challengers Bengaluru', start: '2026-05-07T14:00:00.000Z', venue: 'Bharat Ratna Shri Atal Bihari Vajpayee Ekana Cricket Stadium, Lucknow' },
  { id: 152064, desc: '51st Match', team1: 'Delhi Capitals', team2: 'Kolkata Knight Riders', start: '2026-05-08T14:00:00.000Z', venue: 'Arun Jaitley Stadium, Delhi' },
  { id: 152075, desc: '52nd Match', team1: 'Rajasthan Royals', team2: 'Gujarat Titans', start: '2026-05-09T14:00:00.000Z', venue: 'Sawai Mansingh Stadium, Jaipur' },
  { id: 152086, desc: '53rd Match', team1: 'Chennai Super Kings', team2: 'Lucknow Super Giants', start: '2026-05-10T10:00:00.000Z', venue: 'MA Chidambaram Stadium, Chennai' },
  { id: 152097, desc: '54th Match', team1: 'Royal Challengers Bengaluru', team2: 'Mumbai Indians', start: '2026-05-10T14:00:00.000Z', venue: 'Shaheed Veer Narayan Singh International Stadium, Raipur' },
  { id: 152108, desc: '55th Match', team1: 'Punjab Kings', team2: 'Delhi Capitals', start: '2026-05-11T14:00:00.000Z', venue: 'Himachal Pradesh Cricket Association Stadium, Dharamsala' },
  { id: 152119, desc: '56th Match', team1: 'Gujarat Titans', team2: 'Sunrisers Hyderabad', start: '2026-05-12T14:00:00.000Z', venue: 'Narendra Modi Stadium, Ahmedabad' },
  { id: 152130, desc: '57th Match', team1: 'Royal Challengers Bengaluru', team2: 'Kolkata Knight Riders', start: '2026-05-13T14:00:00.000Z', venue: 'Shaheed Veer Narayan Singh International Stadium, Raipur' },
  { id: 152141, desc: '58th Match', team1: 'Punjab Kings', team2: 'Mumbai Indians', start: '2026-05-14T14:00:00.000Z', venue: 'Himachal Pradesh Cricket Association Stadium, Dharamsala' },
  { id: 152152, desc: '59th Match', team1: 'Lucknow Super Giants', team2: 'Chennai Super Kings', start: '2026-05-15T14:00:00.000Z', venue: 'Bharat Ratna Shri Atal Bihari Vajpayee Ekana Cricket Stadium, Lucknow' },
  { id: 152163, desc: '60th Match', team1: 'Kolkata Knight Riders', team2: 'Gujarat Titans', start: '2026-05-16T14:00:00.000Z', venue: 'Eden Gardens, Kolkata' },
  { id: 152174, desc: '61st Match', team1: 'Punjab Kings', team2: 'Royal Challengers Bengaluru', start: '2026-05-17T10:00:00.000Z', venue: 'Himachal Pradesh Cricket Association Stadium, Dharamsala' },
  { id: 152185, desc: '62nd Match', team1: 'Delhi Capitals', team2: 'Rajasthan Royals', start: '2026-05-17T14:00:00.000Z', venue: 'Arun Jaitley Stadium, Delhi' },
  { id: 152196, desc: '63rd Match', team1: 'Chennai Super Kings', team2: 'Sunrisers Hyderabad', start: '2026-05-18T14:00:00.000Z', venue: 'MA Chidambaram Stadium, Chennai' },
  { id: 152207, desc: '64th Match', team1: 'Rajasthan Royals', team2: 'Lucknow Super Giants', start: '2026-05-19T14:00:00.000Z', venue: 'Sawai Mansingh Stadium, Jaipur' },
  { id: 152218, desc: '65th Match', team1: 'Kolkata Knight Riders', team2: 'Mumbai Indians', start: '2026-05-20T14:00:00.000Z', venue: 'Eden Gardens, Kolkata' },
  { id: 152229, desc: '66th Match', team1: 'Chennai Super Kings', team2: 'Gujarat Titans', start: '2026-05-21T14:00:00.000Z', venue: 'MA Chidambaram Stadium, Chennai' },
  { id: 152240, desc: '67th Match', team1: 'Sunrisers Hyderabad', team2: 'Royal Challengers Bengaluru', start: '2026-05-22T14:00:00.000Z', venue: 'Rajiv Gandhi International Stadium, Hyderabad' },
  { id: 152241, desc: '68th Match', team1: 'Lucknow Super Giants', team2: 'Punjab Kings', start: '2026-05-23T14:00:00.000Z', venue: 'Bharat Ratna Shri Atal Bihari Vajpayee Ekana Cricket Stadium, Lucknow' },
  { id: 152252, desc: '69th Match', team1: 'Mumbai Indians', team2: 'Rajasthan Royals', start: '2026-05-24T10:00:00.000Z', venue: 'Wankhede Stadium, Mumbai' },
  { id: 152263, desc: '70th Match', team1: 'Kolkata Knight Riders', team2: 'Delhi Capitals', start: '2026-05-24T14:00:00.000Z', venue: 'Eden Gardens, Kolkata' },
];

// Convert schedule entries to Match documents (sets status based on current time)
const buildMatches = () => {
  const now = new Date();
  return SCHEDULE.map(m => {
    const startTime = new Date(m.start);
    const endTime = new Date(startTime.getTime() + 4 * 60 * 60 * 1000); // ~4 hr match
    let status = 'upcoming';
    if (now >= endTime) status = 'completed';
    else if (now >= startTime) status = 'live';

    return {
      apiId: String(m.id),
      title: `${m.team1} vs ${m.team2}`,
      desc: m.desc,
      teamA: m.team1,
      teamB: m.team2,
      league: 'Indian Premier League 2026',
      startTime,
      status,
      result: '',
      scoreA: '',
      scoreB: '',
      venue: m.venue,
    };
  });
};

module.exports = { SCHEDULE, buildMatches };
