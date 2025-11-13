const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dwghg78.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const db = client.db('terra_connect');

    const challenges = db.collection('challenges');
    const userChallenges = db.collection('userChallenges');
    const tips = db.collection('tips');
    const events = db.collection('events');

    console.log("MongoDB connected successfully!");

    app.get('/', (req, res) => res.send('Terra Connect server is running!'));

    app.get('/challenges', async (req, res) => {
      const data = await challenges.find().toArray();
      res.send(data);
    });

    app.get('/challenges/active', async (req, res) => {
      const today = new Date().toISOString().split('T')[0];
      const data = await challenges
        .find({
          startDate: { $lte: today },
          endDate: { $gte: today },
        })
        .limit(6)
        .toArray();
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

    app.delete('/user-challenges/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await userChallenges.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "User challenge not found" });
    }
    res.json({ deletedCount: result.deletedCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete user challenge" });
  }
});

app.post('/challenges/join/:id', async (req, res) => {
      const challenge_id = new ObjectId(req.params.id);
      const { buyer_email } = req.body;

      const exists = await userChallenges.findOne({ buyer_email, challenge_id });
      if (exists) return res.status(400).json({ message: "Already joined" });

      const challengeDoc = await challenges.findOne({ _id: challenge_id });

      const doc = {
        buyer_email,
        challenge_id,
        status: "Not Started",
        join_date: new Date(),
        target: challengeDoc.target || 1
      };

      const result = await userChallenges.insertOne(doc);
      await challenges.updateOne({ _id: challenge_id }, { $inc: { participants: 1 } });
      res.send(result);
    });

    app.get('/user-challenges', async (req, res) => {
      const { buyer_email } = req.query;
      const query = {};
      if (buyer_email) query.buyer_email = buyer_email;

      const result = await userChallenges.find(query).toArray();
      res.send(result);
    });

    app.patch('/user-challenges/:id', async (req, res) => {
      const { status } = req.body;
      const id = req.params.id;

      const doc = await userChallenges.findOne({ _id: new ObjectId(id) });
      if (!doc) return res.status(404).json({ message: "User challenge not found" });

      const result = await userChallenges.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status } }
      );

      res.json({ message: "Status updated", result });
    });

    app.post('/user-challenges/manual', async (req, res) => {
      const { buyer_email, challenge_id } = req.body;
      const query = { buyer_email, challenge_id: new ObjectId(challenge_id) };

      const exists = await userChallenges.findOne(query);
      if (exists) return res.status(400).json({ message: "User challenge already exists" });

      const doc = { ...req.body, join_date: new Date() };
      const result = await userChallenges.insertOne(doc);
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



  } catch (err) {
    console.error(err);
  }
}

run().catch(console.dir);

app.listen(port, () => console.log(`Terra Connect server running on port ${port}`));
