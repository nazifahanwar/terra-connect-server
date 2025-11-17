const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');
const app = express();
app.use(cors());
app.use(express.json());
const port = process.env.PORT || 3000;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dwghg78.mongodb.net/?appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

async function run() {
  try {
    // await client.connect();
    const db = client.db('terra_connect');

    const challenges = db.collection('challenges');
    const userChallenges = db.collection('userChallenges');
    const tips = db.collection('tips');
    const events = db.collection('events');

    app.get('/', (req, res) => res.send('Terra Connect server is running!'));

    app.get('/challenges', async (req, res) => {
      const data = await challenges.find().toArray();
      res.send(data);
    });

    app.post('/challenges', async (req, res) => {
  try {
    const challengeData = req.body;

    const result = await challenges.insertOne({
      ...challengeData,
      createdAt: new Date(),
      participants: 0
    });

    res.send(result); 
    
    app.get('/challenges/active', async (req, res) => {
      const today = new Date().toISOString().split('T')[0];
      const data = await challenges.find({
        startDate: { $lte: today },
        endDate: { $gte: today },
      }).limit(6).toArray();
      res.send(data);
    });

    app.get('/challenges/:id', async (req, res) => {
      const data = await challenges.findOne({ _id: new ObjectId(req.params.id) });
      res.send(data);
    });

    app.patch('/challenges/:id', async (req, res) => {
      const result = await challenges.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { ...req.body, updatedAt: new Date() } }
      );
      res.send(result);
    });

    app.delete('/challenges/:id', async (req, res) => {
      const { id } = req.params;
      const { userEmail } = req.body;
      const challenge = await challenges.findOne({ _id: new ObjectId(id) });
      if (!challenge) return res.status(404).send({ message: "Challenge not found" });
      if (challenge.createdBy !== userEmail) return res.status(403).send({ message: "Not allowed" });
      const result = await challenges.deleteOne({ _id: new ObjectId(id) });
      res.send({ message: "Challenge deleted", deletedCount: result.deletedCount });
    });

    app.post('/challenges/join/:id', async (req, res) => {
      const challenge_id = new ObjectId(req.params.id);
      const { buyer_email } = req.body;
      const exists = await userChallenges.findOne({ buyer_email, challenge_id });
      if (exists) return res.status(400).send({ message: "Already joined" });

      const challengeDoc = await challenges.findOne({ _id: challenge_id });
      const doc = {
        buyer_email,
        challenge_id,
        status: "Not Started",
        join_date: new Date(),
        target: challengeDoc.target,
        impact_metric:challengeDoc.impactMetric
      };
      const result = await userChallenges.insertOne(doc);
      await challenges.updateOne({ _id: challenge_id }, { $inc: { participants: 1 } });
      res.send(result);
    });

    app.get('/user-challenges', async (req, res) => {
      const { buyer_email } = req.query;
      const query = buyer_email ? { buyer_email } : {};
      const result = await userChallenges.find(query).sort({ join_date: -1 }).toArray();
      console.log("SORTED RESULT:", result.map(r => r.join_date));
      res.send(result);
    });

   app.patch('/user-challenges/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const id = req.params.id;

    const doc = await userChallenges.findOne({ _id: new ObjectId(id) });

    let updateResult = { modifiedCount: 0 };
    if (doc && doc.status !== status) {
      updateResult = await userChallenges.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status } }
      );
    }

    const stats = await userChallenges.aggregate([
      { $match: { status: "Finished" } },
      { $group: { _id: "$impact_metric", total: { $sum: "$target" } } }
    ]).toArray();

    const communityStats = { plasticSaved: 0, kwhSaved: 0, treesPlanted: 0 };
    stats.forEach(stat => {
      if (stat._id === "kg plastic saved") communityStats.plasticSaved = stat.total;
      else if (stat._id === "kWh saved") communityStats.kwhSaved = stat.total;
      else if (stat._id === "Trees Planted") communityStats.treesPlanted = stat.total;
    });

    res.send({ result: updateResult, communityStats });

  } catch (err) {
    console.error("PATCH error:", err);
    res.status(500).send({ message: "Internal Server Error", error: err.message });
  }
});

    app.post('/user-challenges', async (req, res) => {
  const challengeData = req.body; 
  const result = await userChallenges.insertOne({
    ...challengeData,
    createdAt: new Date()
  });
  res.send(result);
});
   
    app.get('/tips', async (req, res) => {
      const result = await tips.find().toArray();
      res.send(result);
    });

    app.get('/events', async (req, res) => {
      const result = await events.find().toArray();
      res.send(result);
    });
 
     app.get('/community-totals', async (req, res) => {
        const stats = await userChallenges.aggregate([
          { $match: { status: "Finished" } },
          { $group: { _id: "$impact_metric", total: { $sum: "$target" } } }
        ]).toArray();

        const result = { plasticSaved: 0, kwhSaved: 0, treesPlanted: 0 };
        stats.forEach(stat => {
          if (stat._id === "kg plastic saved") result.plasticSaved = stat.total;
          else if (stat._id === "kWh saved") result.kwhSaved = stat.total;
          else if (stat._id === "Trees Planted") result.treesPlanted = stat.total;
        });

        res.send(result);
     });    
    console.log("Connected to MongoDB and routes are ready!");
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
}

run().catch(console.dir);

app.listen(port, () => {
    console.log(`server is running on port: ${port}`)
})