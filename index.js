const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dwghg78.mongodb.net/?appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
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

        app.post('/challenges', async (req, res) => {
            const newChallenge = { ...req.body, participants: 0, createdAt: new Date(), updatedAt: new Date() };
            const result = await challenges.insertOne(newChallenge);
            res.send(result);
        });
                
        app.patch('/challenges/:id', async (req, res) => {
            const result = await challenges.updateOne(
                { _id: new ObjectId(req.params.id) },
                { $set: { ...req.body, updatedAt: new Date() } }
            );
            res.send(result);
        });

        app.delete('/challenges/:id', async (req, res) => {
            const result = await challenges.deleteOne({ _id: new ObjectId(req.params.id) });
            res.send(result);
        });

        app.post('/challenges/join/:id', async (req, res) => {
            const challengeId = new ObjectId(req.params.id);
            const { userId } = req.body;

            const exists = await userChallenges.findOne({ userId, challengeId });
            if (exists) return res.status(400).json({ message: "Already joined" });

            const challengeDoc = await challenges.findOne({ _id: challengeId });

            const doc = {
                userId,
                challengeId,
                status: "Not Started",
                progressCount: 0,
                progress: 0,
                joinDate: new Date(),
                target: challengeDoc.target || 1
            };

            await userChallenges.insertOne(doc);
            await challenges.updateOne({ _id: challengeId }, { $inc: { participants: 1 } });
            res.send(doc);
        });

        app.get('/user-challenges/:userId', async (req, res) => {
            const data = await userChallenges.find({ userId: req.params.userId }).toArray();
            res.send(data);
        });

        app.patch('/user-challenges/:id', async (req, res) => {
            const doc = await userChallenges.findOne({ _id: new ObjectId(req.params.id) });
            if (!doc) return res.status(404).json({ message: "Not found" });

            const challengeDoc = await challenges.findOne({ _id: doc.challengeId });
            const progress = Math.min((req.body.progressCount / (challengeDoc.target || 1)) * 100, 100);
            const status = progress >= 100 ? "Finished" : "Ongoing";

            await userChallenges.updateOne(
                { _id: new ObjectId(req.params.id) },
                { $set: { progressCount: req.body.progressCount, progress, status } }
            );

            res.send({ progressCount: req.body.progressCount, progress, status });
        });

        app.get('/tips', async (req, res) => {
            const data = await tips.find().toArray();
            res.send(data);
        });

        
        app.get('/events', async (req, res) => {
            const data = await events.find().toArray();
            res.send(data);
        });

        

    } catch (err) {
        console.error(err);
    }
}

run().catch(console.dir);

app.listen(port, () => console.log(`Terra Connect server running on port ${port}`));
